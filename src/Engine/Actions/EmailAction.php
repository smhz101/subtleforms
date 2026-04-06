<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;

use SubtleForms\Support\Logger;
final class EmailAction implements ActionInterface {

	public function id(): string {
		return 'email';
	}

	public function label(): string {
		return 'Send email';
	}

	public function validate(): bool {
		return true;
	}

	public function handle( SubmissionContext $context ): void {
		$settings = $context->getMeta( 'current_step_settings', array() );
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		$to      = $settings['to'] ?? null;
		$subject = $settings['subject'] ?? 'Form submission';
		$body    = $settings['body'] ?? $settings['message'] ?? '';
		$headers = $settings['headers'] ?? array();

		// Replace {{field}} placeholders with actual values
		$payload = $context->payload;

		// Add admin_email placeholder
		$payload['admin_email'] = get_option( 'admin_email' );

		// Replace placeholders in recipient, subject, and body
		$to      = $this->replace_placeholders( $to, $payload );
		$subject = $this->replace_placeholders( $subject, $payload );
		$body    = $this->replace_placeholders( $body, $payload );

		if ( empty( $to ) || ! is_string( $to ) ) {
			// Nothing to do; record failure but don't throw to avoid breaking other steps.
			$fail   = $context->getMeta( 'action_failures', array() );
			$fail[] = array(
				'action' => 'email',
				'reason' => 'missing_recipient',
			);
			$context->setMeta( 'action_failures', $fail );

			// Debug logging
			$this->log_debug( $context, 'Email failed: Missing recipient', $settings );
			return;
		}

		// Support comma-separated recipients; sanitize and validate each address.
		$raw_recipients = array_map( 'trim', explode( ',', $to ) );
		$valid_recipients = array();
		$invalid_recipients = array();
		foreach ( $raw_recipients as $addr ) {
			$addr = sanitize_email( $addr );
			if ( is_email( $addr ) ) {
				$valid_recipients[] = $addr;
			} else {
				$invalid_recipients[] = $addr;
			}
		}

		if ( empty( $valid_recipients ) ) {
			$fail   = $context->getMeta( 'action_failures', array() );
			$fail[] = array(
				'action' => 'email',
				'reason' => 'invalid_recipient',
				'to'     => $to,
			);
			$context->setMeta( 'action_failures', $fail );

			$this->log_debug( $context, 'Email failed: No valid recipient addresses', array( 'to' => $to ) );
			return;
		}

		if ( ! empty( $invalid_recipients ) ) {
			$this->log_debug( $context, 'Email: Skipping invalid addresses', array( 'invalid' => $invalid_recipients ) );
		}

		$to = implode( ', ', $valid_recipients );

		// Deterministic content: use payload JSON if body not provided
		if ( $body === '' ) {
			$body = wp_json_encode( $context->payload );
		}

		// Ensure headers is array
		if ( ! is_array( $headers ) ) {
			$headers = array();
		}

		// Strip CRLF from each header to prevent header injection attacks.
		$headers = array_map(
			static function ( $header ) {
				return is_string( $header ) ? preg_replace( '/[\r\n]+/', '', $header ) : $header;
			},
			$headers
		);

		// Add default headers
		if ( ! $this->has_header( $headers, 'Content-Type' ) ) {
			$headers[] = 'Content-Type: text/plain; charset=UTF-8';
		}

		// Debug logging before send
		$this->log_debug(
			$context,
			'Attempting to send email',
			array(
				'to'      => $to,
				'subject' => $subject,
				'body'    => substr( $body, 0, 200 ) . '...',
			)
		);

		// Dispatch email asynchronously - returns immediately
		$submission_id = $context->getMeta( 'submission_id' );
                $step_id       = $context->getMeta( 'current_step_id', 'email' );
                $dispatched = \SubtleForms\Async\AsyncDispatcher::dispatchEmail( array(
                        'to'            => $to,
                        'subject'       => $subject,
                        'body'          => $body,
                        'headers'       => $headers,
                        'submission_id' => $submission_id,
                        'step_id'       => $step_id,
                ) );

                if ( ! $dispatched ) {
                        // Failed to schedule (rare - only if cron system broken)
                        $fail   = $context->getMeta( 'action_failures', array() );
                        $fail[] = array(
                                'action' => 'email',
                                'reason' => 'async_dispatch_failed',
                                'to'     => $to,
                        );
                        $context->setMeta( 'action_failures', $fail );

                        $this->log_debug( $context, 'Email async dispatch failed', array( 'to' => $to ) );
                } else {
                        // Successfully queued (actual send happens async)
                        $this->log_debug( $context, 'Email queued for async delivery', array( 'to' => $to ) );
                }

                // Capture dispatch details for pipeline log enrichment.
                $context->setMeta(
                        'step_output_data',
                        array(
                                'to'               => $to,
                                'subject'          => $subject,
                                'body_preview'     => substr( $body, 0, 300 ),
                                'recipients_count' => count( $valid_recipients ),
                                'dispatch_method'  => 'async_cron',
                                'dispatched'       => $dispatched,
                        )
                );
        }

        /**
         * Replace {{field}} placeholders with actual values.
	 *
	 * @param string $template Template string with placeholders.
	 * @param array  $data     Data array to replace placeholders with.
	 * @return string Template with placeholders replaced.
	 */
	private function replace_placeholders( $template, $data ) {
		if ( ! is_string( $template ) ) {
			return $template;
		}

		// Find all {{field}} patterns
		preg_match_all( '/\{\{([a-zA-Z0-9_]+)\}\}/', $template, $matches );

		if ( empty( $matches[1] ) ) {
			return $template;
		}

		// Replace each placeholder
		foreach ( $matches[1] as $field ) {
			$value = $data[ $field ] ?? '';

			// Handle arrays (checkboxes, multi-select)
			if ( is_array( $value ) ) {
				$value = implode( ', ', $value );
			}

			$template = str_replace( '{{' . $field . '}}', $value, $template );
		}

		return $template;
	}

	/**
	 * Check if headers array contains a specific header type.
	 *
	 * @param array  $headers Headers array.
	 * @param string $type    Header type to check for (e.g., 'Content-Type').
	 * @return bool True if header exists, false otherwise.
	 */
	private function has_header( $headers, $type ) {
		foreach ( $headers as $header ) {
			if ( stripos( $header, $type ) === 0 ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Log debug information if debug mode is enabled.
	 *
	 * @param SubmissionContext $context Submission context.
	 * @param string            $message Log message.
	 * @param array             $data    Additional data to log.
	 */
	private function log_debug( $context, $message, $data = array() ) {
		// Only log if debug mode is enabled
		$settings = get_option( 'subtleforms_settings', array() );
		if ( empty( $settings['debug_mode'] ) ) {
			return;
		}

		$submission_id = $context->getMeta( 'submission_id', 'unknown' );

		Logger::error(
			sprintf(
				'SubtleForms Email Debug [Submission #%s]: %s | Data: %s',
				$submission_id,
				$message,
				wp_json_encode( $data )
			)
		);
	}
}
