<?php

declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;

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

		// URL (required)
		$url = $settings['url'] ?? null;
		if ( empty( $url ) || ! is_string( $url ) || ! wp_http_validate_url( $url ) ) {
			$this->fail( $context, 'invalid_url', array( 'url' => (string) $url ) );
			return;
		}

		// Method: POST | PUT | PATCH (default POST)
		$allowed_methods = array( 'POST', 'PUT', 'PATCH' );
		$method          = strtoupper( $settings['method'] ?? 'POST' );
		if ( ! in_array( $method, $allowed_methods, true ) ) {
			$method = 'POST';
		}

		// Payload mode: full (default) | custom
		$payload_mode = $settings['payload_mode'] ?? 'full';

		if ( 'custom' === $payload_mode ) {
			$raw_custom = $settings['custom_payload'] ?? '';
			if ( '' !== $raw_custom ) {
				$decoded = json_decode( $raw_custom, true );
				if ( json_last_error() !== JSON_ERROR_NONE ) {
					$this->fail( $context, 'invalid_custom_payload', array( 'error' => json_last_error_msg() ) );
					return;
				}
				$answers = array();
				foreach ( (array) $context->payload as $key => $value ) {
					if ( is_scalar( $value ) ) {
						$answers[ (string) $key ] = (string) $value;
					}
				}
				$schema = $context->getMeta( 'form_schema' );
				$schema = is_array( $schema ) ? $schema : array();
				$decoded = self::fillCustomPayload(
					$decoded,
					$answers,
					array(
						'form_title' => (string) ( $schema['metadata']['title'] ?? '' ),
						'entry_id'   => (string) ( $context->getMeta( 'submission_id', '' ) ),
					)
				);
				$body = wp_json_encode( $decoded );
			} else {
				$body = '{}';
			}
		} else {
			// 'full', entire submission payload
			$body = wp_json_encode( $context->payload );
		}

		// Headers: merge user-supplied over default Content-Type
		$user_headers = $settings['headers'] ?? array();
		if ( ! is_array( $user_headers ) ) {
			$user_headers = array();
		}

		// Sanitize: prevent header injection via CR/LF
		$safe_headers = array();
		foreach ( $user_headers as $name => $value ) {
			$name  = (string) $name;
			$value = (string) $value;
			if ( strpbrk( $name, "\r\n" ) !== false || strpbrk( $value, "\r\n" ) !== false ) {
				continue;
			}
			$safe_headers[ $name ] = $value;
		}

		$headers = array_merge(
			array( 'Content-Type' => 'application/json' ),
			$safe_headers
		);

		// Signing: HMAC-SHA256, adds X-SubtleForms-Signature header
		$signing = $settings['signing'] ?? array();
		if ( is_array( $signing ) && ! empty( $signing['enabled'] ) && empty( $signing['secret'] ) ) {
			// No secret on the action: use the default from Settings > Integrations > Webhooks.
			$global            = get_option( 'subtleforms_settings', array() );
			$signing['secret'] = is_array( $global ) ? (string) ( $global['ext_webhooks_signing_secret'] ?? '' ) : '';
		}
		if (
			is_array( $signing ) &&
			! empty( $signing['enabled'] ) &&
			! empty( $signing['secret'] ) &&
			is_string( $signing['secret'] )
		) {
			$signature                          = 'sha256=' . hash_hmac( 'sha256', (string) $body, $signing['secret'] );
			$headers['X-SubtleForms-Signature'] = $signature;
		}

		// Dispatch asynchronously via WP-Cron
		$submission_id = $context->getMeta( 'submission_id' );
                $step_id       = $context->getMeta( 'current_step_id', 'webhook' );
                $dispatched    = \SubtleForms\Async\AsyncDispatcher::dispatchWebhook( array(
                        'url'           => $url,
                        'method'        => $method,
                        'headers'       => $headers,
                        'body'          => $body,
                        'timeout'       => 10,
                        'submission_id' => $submission_id,
                        'step_id'       => $step_id,
                ) );

                if ( ! $dispatched ) {
                        $this->fail( $context, 'async_dispatch_failed', array( 'url' => $url ) );
                }

                // Capture dispatch details for pipeline log enrichment.
                $signed = is_array( $signing ) && ! empty( $signing['enabled'] );
                $context->setMeta(
                        'step_output_data',
                        array(
                                'url'                => $url,
                                'method'             => $method,
                                'payload_mode'       => $payload_mode,
                                'payload_size_bytes' => strlen( (string) $body ),
                                'signed'             => $signed,
                                'dispatch_method'    => 'async_cron',
                                'dispatched'         => $dispatched,
                        )
                );
        }

        /**
         * Record an action failure into context meta.
	 */
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

	private function fail( SubmissionContext $context, string $reason, array $extra = array() ): void {
		$fail   = $context->getMeta( 'action_failures', array() );
		$fail[] = array_merge( array( 'action' => 'webhook', 'reason' => $reason ), $extra );
		$context->setMeta( 'action_failures', $fail );
	}
}
