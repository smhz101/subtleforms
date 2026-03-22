<?php
declare(strict_types=1);

namespace SubtleForms\Async;


use SubtleForms\Support\Logger;
/**
 * AsyncDispatcher - WordPress-native async job dispatcher
 * 
 * Moves slow operations (emails, webhooks) out of the request lifecycle
 * using wp_schedule_single_event for non-blocking execution.
 * 
 * Features:
 * - Returns immediately (no blocking)
 * - Failure isolation (errors don't break submissions)
 * - Simple retry mechanism
 * - WordPress-native (no external dependencies)
 * 
 * @since 1.8.2
 */
final class AsyncDispatcher {

	/**
	 * Dispatch an async email job
	 * 
	 * @param array $payload {
	 *     @type string       $to         Recipient email address
	 *     @type string       $subject    Email subject
	 *     @type string       $body       Email body
	 *     @type array|string $headers    Optional email headers
	 *     @type array        $attachments Optional attachments
	 *     @type int          $submission_id Optional submission ID for logging
	 *     @type int          $retry_count Current retry attempt (0-based)
	 * }
	 * @return bool True if job scheduled, false otherwise
	 */
	public static function dispatchEmail( array $payload ): bool {
		// Validate required fields
		if ( empty( $payload['to'] ) || empty( $payload['subject'] ) ) {
			self::log( 'Email dispatch failed: missing required fields', $payload );
			return false;
		}

		// Normalize payload
		$job = array(
			'to'            => $payload['to'],
			'subject'       => $payload['subject'],
			'body'          => $payload['body'] ?? '',
			'headers'       => $payload['headers'] ?? array(),
			'attachments'   => $payload['attachments'] ?? array(),
			'submission_id' => $payload['submission_id'] ?? null,
			'retry_count'   => $payload['retry_count'] ?? 0,
		);

		// Schedule for immediate execution (0 delay)
		$scheduled = wp_schedule_single_event(
			time(),
			'subtleforms_async_email',
			array( $job )
		);

		if ( $scheduled === false ) {
			self::log( 'Failed to schedule email job', $job );
			return false;
		}

		self::log( 'Email job scheduled', array(
			'to'            => $job['to'],
			'submission_id' => $job['submission_id'],
		) );

		return true;
	}

	/**
	 * Dispatch an async webhook job
	 * 
	 * @param array $payload {
	 *     @type string $url          Webhook URL
	 *     @type array  $headers      HTTP headers
	 *     @type string $body         Request body
	 *     @type int    $timeout      Request timeout in seconds (default: 10)
	 *     @type int    $submission_id Optional submission ID for logging
	 *     @type int    $retry_count  Current retry attempt (0-based)
	 * }
	 * @return bool True if job scheduled, false otherwise
	 */
	public static function dispatchWebhook( array $payload ): bool {
		// Validate required fields
		if ( empty( $payload['url'] ) ) {
			self::log( 'Webhook dispatch failed: missing URL', $payload );
			return false;
		}

		// Normalize payload
		$job = array(
			'url'           => $payload['url'],
			'method'        => $payload['method'] ?? 'POST',
			'headers'       => $payload['headers'] ?? array( 'Content-Type' => 'application/json' ),
			'body'          => $payload['body'] ?? '',
			'timeout'       => $payload['timeout'] ?? 10,
			'submission_id' => $payload['submission_id'] ?? null,
			'retry_count'   => $payload['retry_count'] ?? 0,
		);

		// Schedule for immediate execution (0 delay)
		$scheduled = wp_schedule_single_event(
			time(),
			'subtleforms_async_webhook',
			array( $job )
		);

		if ( $scheduled === false ) {
			self::log( 'Failed to schedule webhook job', $job );
			return false;
		}

		self::log( 'Webhook job scheduled', array(
			'url'           => $job['url'],
			'submission_id' => $job['submission_id'],
		) );

		return true;
	}

	/**
	 * Execute async email job (called by WP Cron)
	 * 
	 * @param array $job Email job payload
	 * @return void
	 */
	public static function executeEmail( array $job ): void {
		$retry_count = $job['retry_count'] ?? 0;

		try {
			self::log( "Executing email job (attempt #{$retry_count})", array(
				'to'            => $job['to'],
				'submission_id' => $job['submission_id'] ?? null,
			) );

			$sent = \SubtleForms\Support\Mailer::send(
				$job['to'],
				$job['subject'],
				$job['body'],
				$job['headers'] ?? array(),
				$job['attachments'] ?? array()
			);

			if ( ! $sent ) {
				throw new \RuntimeException( 'wp_mail returned false' );
			}

			self::log( 'Email sent successfully', array(
				'to'            => $job['to'],
				'submission_id' => $job['submission_id'] ?? null,
			) );

		} catch ( \Throwable $e ) {
			self::log( 'Email execution failed', array(
				'to'            => $job['to'],
				'error'         => $e->getMessage(),
				'retry_count'   => $retry_count,
				'submission_id' => $job['submission_id'] ?? null,
			) );

			// Retry logic: max 3 attempts
			if ( $retry_count < 3 ) {
				$job['retry_count'] = $retry_count + 1;
				
				// Schedule retry with exponential backoff: 5min, 15min, 30min
				$delays = array( 300, 900, 1800 );
				$delay = $delays[ $retry_count ] ?? 1800;
				
				wp_schedule_single_event(
					time() + $delay,
					'subtleforms_async_email',
					array( $job )
				);

				self::log( "Email retry scheduled (#{$job['retry_count']} in {$delay}s)", array(
					'to'            => $job['to'],
					'submission_id' => $job['submission_id'] ?? null,
				) );
			} else {
				self::log( 'Email failed after max retries', array(
					'to'            => $job['to'],
					'submission_id' => $job['submission_id'] ?? null,
				) );
			}
		}
	}

	/**
	 * Execute async webhook job (called by WP Cron)
	 * 
	 * @param array $job Webhook job payload
	 * @return void
	 */
	public static function executeWebhook( array $job ): void {
		$retry_count = $job['retry_count'] ?? 0;

		try {
			self::log( "Executing webhook job (attempt #{$retry_count})", array(
				'url'           => $job['url'],
				'method'        => $job['method'] ?? 'POST',
				'submission_id' => $job['submission_id'] ?? null,
			) );

			$method = strtoupper( $job['method'] ?? 'POST' );

			$response = wp_remote_request(
				$job['url'],
				array(
					'method'  => $method,
					'headers' => $job['headers'],
					'body'    => $job['body'],
					'timeout' => $job['timeout'] ?? 10,
				)
			);

			if ( is_wp_error( $response ) ) {
				throw new \RuntimeException( $response->get_error_message() );
			}

			$code = wp_remote_retrieve_response_code( $response );
			if ( $code >= 400 ) {
				throw new \RuntimeException( "HTTP {$code}: " . wp_remote_retrieve_response_message( $response ) );
			}

			self::log( 'Webhook executed successfully', array(
				'url'           => $job['url'],
				'method'        => $method,
				'status'        => $code,
				'submission_id' => $job['submission_id'] ?? null,
			) );

		} catch ( \Throwable $e ) {
			self::log( 'Webhook execution failed', array(
				'url'           => $job['url'],
				'error'         => $e->getMessage(),
				'retry_count'   => $retry_count,
				'submission_id' => $job['submission_id'] ?? null,
			) );

			// Retry logic: max 3 attempts
			if ( $retry_count < 3 ) {
				$job['retry_count'] = $retry_count + 1;
				
				// Schedule retry with exponential backoff: 2min, 5min, 10min
				$delays = array( 120, 300, 600 );
				$delay = $delays[ $retry_count ] ?? 600;
				
				wp_schedule_single_event(
					time() + $delay,
					'subtleforms_async_webhook',
					array( $job )
				);

				self::log( "Webhook retry scheduled (#{$job['retry_count']} in {$delay}s)", array(
					'url'           => $job['url'],
					'submission_id' => $job['submission_id'] ?? null,
				) );
			} else {
				self::log( 'Webhook failed after max retries', array(
					'url'           => $job['url'],
					'submission_id' => $job['submission_id'] ?? null,
				) );
			}
		}
	}

	/**
	 * Internal logging helper
	 * 
	 * @param string $message Log message
	 * @param array  $context Optional context data
	 * @return void
	 */
	private static function log( string $message, array $context = array() ): void {
		$context_str = empty( $context ) ? '' : ' | ' . wp_json_encode( $context );
		Logger::error( "[SubtleForms Async] {$message}{$context_str}" );
	}
}
