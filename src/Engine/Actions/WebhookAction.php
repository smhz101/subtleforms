<?php

declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Support\Webhooks;

final class WebhookAction implements ActionInterface {

	public function id(): string {
		return 'webhook';
	}

	public function label(): string {
		return 'Call webhook';
	}

	public function validate(): bool {
		return true;
	}

	public function handle( SubmissionContext $context ): void {
		$settings = $context->getMeta( 'current_step_settings', array() );
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		// URL (required). "hooks.example.com/x" means https://hooks.example.com/x.
		$url     = Webhooks::normalizeUrl( is_string( $settings['url'] ?? null ) ? $settings['url'] : '' );
		$problem = Webhooks::urlProblem( $url );
		if ( $problem ) {
			$this->fail( $context, $problem->get_error_code(), array( 'url' => $url, 'response' => $problem->get_error_message() ) );
			return;
		}

		// Method: POST | PUT | PATCH (default POST)
		$allowed_methods = array( 'POST', 'PUT', 'PATCH' );
		$method          = strtoupper( (string) ( $settings['method'] ?? 'POST' ) );
		if ( ! in_array( $method, $allowed_methods, true ) ) {
			$method = 'POST';
		}

		$schema  = $context->getMeta( 'form_schema' );
		$schema  = is_array( $schema ) ? $schema : array();
		$answers = Webhooks::answers( is_array( $context->payload ) ? $context->payload : array(), $schema );

		// Payload mode: full (default) | custom
		$payload_mode = ( $settings['payload_mode'] ?? 'full' ) === 'custom' ? 'custom' : 'full';

		if ( 'custom' === $payload_mode ) {
			$raw_custom = (string) ( $settings['custom_payload'] ?? '' );
			if ( '' !== trim( $raw_custom ) ) {
				$decoded = json_decode( $raw_custom, true );
				if ( json_last_error() !== JSON_ERROR_NONE ) {
					$this->fail( $context, 'invalid_custom_payload', array( 'error' => json_last_error_msg() ) );
					return;
				}
				$scalar = array();
				foreach ( $answers as $key => $value ) {
					if ( is_scalar( $value ) ) {
						$scalar[ (string) $key ] = (string) $value;
					}
				}
				$decoded = self::fillCustomPayload(
					$decoded,
					$scalar,
					array(
						'form_title' => (string) ( $schema['metadata']['title'] ?? '' ),
						'entry_id'   => (string) ( $context->getMeta( 'submission_id', '' ) ),
					)
				);
				$body = (string) wp_json_encode( $decoded );
			} else {
				$body = '{}';
			}
		} else {
			// The documented body: form, entry, answers keyed by field and with labels.
			$body = (string) wp_json_encode(
				Webhooks::fullBody(
					$schema,
					$answers,
					array(
						'form_id'       => (int) $context->formId,
						'form_title'    => (string) ( $schema['metadata']['title'] ?? ( $schema['metadata']['name'] ?? '' ) ),
						'submission_id' => (int) $context->getMeta( 'submission_id', 0 ),
						'submitted_at'  => gmdate( 'c' ),
					)
				)
			);
		}

		$headers = array_merge(
			array( 'Content-Type' => 'application/json' ),
			Webhooks::safeHeaders( $settings['headers'] ?? array() )
		);

		// Signing: HMAC-SHA256, adds X-SubtleForms-Signature header
		$signing = is_array( $settings['signing'] ?? null ) ? $settings['signing'] : array();
		if ( ! empty( $signing['enabled'] ) && empty( $signing['secret'] ) ) {
			// No secret on the action: use the default from Settings > Integrations > Webhooks.
			$global            = get_option( 'subtleforms_settings', array() );
			$signing['secret'] = is_array( $global ) ? (string) ( $global['ext_webhooks_signing_secret'] ?? '' ) : '';
		}
		$signed = ! empty( $signing['enabled'] ) && is_string( $signing['secret'] ?? null ) && '' !== $signing['secret'];
		if ( $signed ) {
			$headers['X-SubtleForms-Signature'] = Webhooks::signature( $body, (string) $signing['secret'] );
		}

		// Dispatch asynchronously via WP-Cron
		$submission_id = $context->getMeta( 'submission_id' );
		$step_id       = $context->getMeta( 'current_step_id', 'webhook' );
		$dispatched    = \SubtleForms\Async\AsyncDispatcher::dispatchWebhook(
			array(
				'url'           => $url,
				'method'        => $method,
				'headers'       => $headers,
				'body'          => $body,
				'timeout'       => 10,
				'submission_id' => $submission_id,
				'step_id'       => $step_id,
			)
		);

		if ( ! $dispatched ) {
			$this->fail( $context, 'async_dispatch_failed', array( 'url' => $url ) );
		}

		// Capture dispatch details for pipeline log enrichment.
		$context->setMeta(
			'step_output_data',
			array(
				'url'                => $url,
				'method'             => $method,
				'payload_mode'       => $payload_mode,
				'payload_size_bytes' => strlen( $body ),
				'signed'             => $signed,
				'dispatch_method'    => 'async_cron',
				'dispatched'         => $dispatched,
			)
		);
	}

	/**
	 * Fill merge tags inside a custom JSON payload. Tags are replaced in
	 * string values after the JSON is decoded, so {"name":"{{name}}"} sends
	 * the answer rather than the tag.
	 *
	 * @param mixed $value Decoded JSON.
	 * @param array $answers Field key to answer.
	 * @param array $context form_title and entry_id.
	 * @return mixed
	 */
	public static function fillCustomPayload( $value, array $answers, array $context = array() ) {
		if ( is_array( $value ) ) {
			$filled = array();
			foreach ( $value as $key => $item ) {
				$filled[ $key ] = self::fillCustomPayload( $item, $answers, $context );
			}
			return $filled;
		}
		if ( ! is_string( $value ) || ! str_contains( $value, '{' ) ) {
			return $value;
		}
		$merge = array(
			'answers'    => $answers,
			'form_title' => (string) ( $context['form_title'] ?? '' ),
			'entry_id'   => (string) ( $context['entry_id'] ?? '' ),
		);
		return \SubtleForms\Support\MergeTags::render( $value, $merge, false );
	}

	/**
	 * Record an action failure into context meta. A "response" entry is
	 * shown in the entry's activity log instead of the reason code.
	 *
	 * @param SubmissionContext $context Context.
	 * @param string            $reason  Reason code.
	 * @param array             $extra   Extra details.
	 */
	private function fail( SubmissionContext $context, string $reason, array $extra = array() ): void {
		$fail   = $context->getMeta( 'action_failures', array() );
		$fail[] = array_merge( array( 'action' => 'webhook', 'reason' => $reason ), $extra );
		$context->setMeta( 'action_failures', $fail );
	}
}
