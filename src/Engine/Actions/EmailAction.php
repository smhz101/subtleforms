<?php

declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
		$schema  = $context->getMeta( 'form_schema' );
		$schema  = is_array( $schema ) ? $schema : array();
		$isHtml  = $this->is_html( $settings, $headers );

		// Passwords never go out by email (2.2.1).
		foreach ( \SubtleForms\Support\EntryValues::secretKeys( $schema ) as $secretKey ) {
			unset( $payload[ $secretKey ] );
		}

		// Answers as text (recipient, subject, plain emails) or escaped HTML
		// with line breaks kept (HTML email bodies), through the one answer
		// formatter. Uploaded files read as "name (download link)" (2.1).
		$display     = \SubtleForms\Support\AnswerFormatter::context(
			$schema,
			array(
				'submission_id' => (int) $context->getMeta( 'submission_id', 0 ),
				'links'         => true,
			)
		);
		$textPayload = $this->format_answers( $payload, $schema, false, $display );
		$bodyPayload = $isHtml ? $this->format_answers( $payload, $schema, true, $display ) : $textPayload;

		// Merge tags (2.3): {all_fields}, {field:key}, {form_title},
		// {entry_id}, {site_name}, {admin_email}, {date}, in single or double
		// braces. A message left empty sends every answer.
		$mergeContext = array(
			'fields'     => \SubtleForms\Support\FieldMapper::fields( $schema ),
			'form_title' => (string) ( $schema['metadata']['title'] ?? '' ),
			'entry_id'   => (int) $context->getMeta( 'submission_id', 0 ),
		);
		if ( ! is_string( $body ) || trim( $body ) === '' ) {
			$body = '{all_fields}';
		}

		$to      = is_string( $to ) ? \SubtleForms\Support\MergeTags::render( $to, array( 'answers' => $textPayload ) + $mergeContext, false ) : $to;
		$subject = is_string( $subject ) ? \SubtleForms\Support\MergeTags::render( $subject, array( 'answers' => $textPayload ) + $mergeContext, false ) : $subject;
		// A subject is one line, whatever the answers merged into it hold.
		$subject = is_string( $subject ) ? trim( (string) preg_replace( '/[\r\n]+/', ' ', $subject ) ) : $subject;
		// An HTML email keeps the line breaks typed into the message itself.
		if ( $isHtml && ! preg_match( '/<(p|br|div|table|ul|ol|h[1-6])\b/i', (string) $body ) ) {
			$body = nl2br( (string) $body );
		}
		$body    = \SubtleForms\Support\MergeTags::render( (string) $body, array( 'answers' => $bodyPayload ) + $mergeContext, $isHtml );

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

		// Nothing answered at all: say so rather than send a blank email.
		if ( trim( wp_strip_all_tags( $body ) ) === '' ) {
			$body = __( 'A new entry was submitted with no answers.', 'subtleforms' );
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
			$headers[] = $isHtml ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8';
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
                        'form_id'       => $context->formId,
                        'audience'      => $this->audience( $settings['to'] ?? '' ),
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
	 * Whether this email is sent as HTML.
	 *
	 * @param array $settings Action settings.
	 * @param mixed $headers  Configured headers.
	 * @return bool
	 */
	private function is_html( array $settings, $headers ): bool {
		if ( isset( $settings['format'] ) && $settings['format'] === 'html' ) {
			return true;
		}
		foreach ( (array) $headers as $header ) {
			if ( is_string( $header ) && preg_match( '#^\s*content-type\s*:\s*text/html#i', $header ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Turn stored answers into the text that replaces their placeholders.
	 *
	 * Every answer goes through the one answer formatter (2.4.0): option
	 * labels, Yes/No, matrix rows and columns, dates in the field format and
	 * file names with links. Paragraph answers keep their line breaks: as-is
	 * in plain text, as <br> in HTML (2.2.1, bug 4). Rich text keeps its
	 * formatting in HTML and reads as plain text otherwise.
	 *
	 * @param array $payload Answers.
	 * @param array $schema  Form schema.
	 * @param bool  $isHtml  Whether the email is HTML.
	 * @param array $display Display context.
	 * @return array
	 */
	private function format_answers( array $payload, array $schema, bool $isHtml, array $display ): array {
		$fields = array();
		foreach ( \SubtleForms\Support\FieldMapper::fields( $schema ) as $entry ) {
			$fields[ $entry['key'] ] = $entry['field'];
		}
		foreach ( $payload as $key => $value ) {
			$field           = $fields[ $key ] ?? array( 'type' => '' );
			$payload[ $key ] = $isHtml
				? \SubtleForms\Support\EntryValues::toHtml( $value, $field, $display )
				: \SubtleForms\Support\EntryValues::toText( $value, $field, $display );
		}
		return $payload;
	}

	/**
	 * Who an email action writes to, judged from its unreplaced recipient.
	 *
	 * A recipient built from an answer placeholder such as {{email}} goes to the
	 * person who filled in the form; anything else (a fixed address or
	 * {{admin_email}}) is a notification for the site owner. Add-ons use this
	 * to decide what to attach, e.g. an entry PDF only on admin notifications.
	 *
	 * @param mixed $rawTo Recipient setting before placeholders are replaced.
	 * @return string 'admin' or 'submitter'.
	 */
	private function audience( $rawTo ): string {
		if ( ! is_string( $rawTo ) ) {
			return 'admin';
		}
		$fieldTokens = preg_replace( '/\{\{?\s*(admin_email|site_name|form_title|entry_id|date)\s*\}?\}/', '', $rawTo );
		return preg_match( '/\{\{?\s*(field:)?[a-zA-Z0-9_]+\s*\}?\}/', (string) $fieldTokens ) ? 'submitter' : 'admin';
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
