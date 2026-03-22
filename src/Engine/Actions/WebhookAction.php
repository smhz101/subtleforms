<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

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
				$body = wp_json_encode( $decoded );
			} else {
				$body = '{}';
			}
		} else {
			// 'full' — entire submission payload
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

		// Signing: HMAC-SHA256 — adds X-SubtleForms-Signature header
		$signing = $settings['signing'] ?? array();
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
		$dispatched    = \SubtleForms\Async\AsyncDispatcher::dispatchWebhook( array(
			'url'           => $url,
			'method'        => $method,
			'headers'       => $headers,
			'body'          => $body,
			'timeout'       => 10,
			'submission_id' => $submission_id,
		) );

		if ( ! $dispatched ) {
			$this->fail( $context, 'async_dispatch_failed', array( 'url' => $url ) );
		}
	}

	/**
	 * Record an action failure into context meta.
	 */
	private function fail( SubmissionContext $context, string $reason, array $extra = array() ): void {
		$fail   = $context->getMeta( 'action_failures', array() );
		$fail[] = array_merge( array( 'action' => 'webhook', 'reason' => $reason ), $extra );
		$context->setMeta( 'action_failures', $fail );
	}
}
