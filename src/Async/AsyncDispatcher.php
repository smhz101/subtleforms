<?php

declare(strict_types=1);

namespace SubtleForms\Async;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
	 * The job EmailAction produced while an email is built again, else null.
	 *
	 * @var array|null
	 */
	private static $captured = null;

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
		/**
	 * An id that makes two otherwise identical cron jobs different.
	 *
	 * @return string
	 */
	public static function dispatchId(): string {
		return uniqid( 'sf', true );
	}

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
			'step_id'       => $payload['step_id'] ?? 'email',
			'form_id'       => isset( $payload['form_id'] ) ? (int) $payload['form_id'] : 0,
			'audience'      => $payload['audience'] ?? 'admin',
			'step_sig'      => $payload['step_sig'] ?? '',
			'retry_count'   => $payload['retry_count'] ?? 0,
			// A fresh id so a second send within ten minutes is not dropped as a duplicate cron event.
			'dispatch_id'   => self::dispatchId(),
		);

		// Building the email again for a job whose stored details are gone
		// (rebuildEmail): hand the job back instead of queueing it.
		if ( null !== self::$captured ) {
			self::$captured = $job;
			return true;
		}

		// Schedule for immediate execution (0 delay). The cron option holds
		// only a reference; the recipients, body and headers wait in the
		// options table until the job runs and are loaded then.
		$scheduled = wp_schedule_single_event(
			time(),
			'subtleforms_async_email',
			array( self::stash( $job ) )
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
			'step_id'       => $payload['step_id'] ?? 'webhook',
			'retry_count'   => $payload['retry_count'] ?? 0,
			'dispatch_id'   => self::dispatchId(),
		);

		// Same as email: the cron option holds a reference only.
		$scheduled = wp_schedule_single_event(
			time(),
			'subtleforms_async_webhook',
			array( self::stash( $job ) )
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
	 * Queue an email marketing job for an entry and one service.
	 *
	 * The job carries the entry ID, never the answers: they are read back
	 * from the entry when the job runs.
	 *
	 * @param array $job   { service, submission_id, form_id, retry_count, feeds }.
	 * @param int   $delay Seconds until it runs.
	 * @return bool True if the job was scheduled.
	 */
	public static function dispatchEmailMarketing( array $job, int $delay = 0 ): bool {
		if ( empty( $job['submission_id'] ) || empty( $job['service'] ) ) {
			self::log( 'Email marketing dispatch failed: missing entry or service' );
			return false;
		}
		$job['dispatch_id'] = self::dispatchId();
		$scheduled          = wp_schedule_single_event( time() + max( 0, $delay ), 'subtleforms_async_email_marketing', array( $job ) );
		if ( false === $scheduled ) {
			self::log( 'Failed to schedule email marketing job', array( 'submission_id' => $job['submission_id'], 'service' => $job['service'] ) );
			return false;
		}
		return true;
	}

	/**
	 * Execute an email marketing job (called by WP Cron).
	 *
	 * @param array $job Job from dispatchEmailMarketing().
	 * @return void
	 */
	public static function executeEmailMarketing( array $job ): void {
		\SubtleForms\Integrations\EmailMarketing\Sender::run( $job );
	}

	/**
	 * Execute async email job (called by WP Cron)
	 * 
	 * @param array $job Email job payload
	 * @return void
	 */
	public static function executeEmail( array $job ): void {
		$reference = $job;
		$job       = self::resolve( $job );
		if ( null === $job ) {
			// This event already ran (WP-Cron started it twice, or someone ran
			// it by hand): its email is sent, or on its way. Do not send it again.
			if ( isset( $reference['job_ref'] ) && self::handled( (string) $reference['job_ref'] ) ) {
				self::log( 'Email job skipped: it already ran', array( 'submission_id' => $reference['submission_id'] ?? null ) );
				return;
			}
			// The stored details are gone (a job queued before 2.8.1 whose
			// 6 hour copy expired, or one removed as an orphan). The entry is
			// saved, so the email is built again from it rather than lost.
			$job = self::rebuildEmail( $reference );
			if ( null === $job ) {
				self::log( 'Email job skipped: its stored details are gone and the entry could not be used to build it again', array( 'submission_id' => $reference['submission_id'] ?? null ) );
				return;
			}
			self::log( 'Email built again from the saved entry', array( 'submission_id' => $reference['submission_id'] ?? null ) );
		}
		// The stored copy has done its job: it is replaced by a note that the
		// job ran, and written again only if a retry is scheduled.
		self::forget( $job );
		$retry_count   = $job['retry_count'] ?? 0;
		$submission_id = isset( $job['submission_id'] ) ? (int) $job['submission_id'] : 0;
		$step_id       = $job['step_id'] ?? 'email';

		try {
			self::log( "Executing email job (attempt #{$retry_count})", array(
				'to'            => $job['to'],
				'submission_id' => $submission_id ?: null,
			) );

			$attachments = is_array( $job['attachments'] ?? null ) ? $job['attachments'] : array();

			/**
			 * Filter the files attached to a SubtleForms email.
			 *
			 * Runs in the background job, after the visitor's request has
			 * finished, so generating a file here (such as an entry PDF) does
			 * not slow the submission down. Return absolute file paths.
			 *
			 * @param string[] $attachments Absolute paths.
			 * @param array    $job {
			 *     @type string $to            Recipient(s).
			 *     @type int    $submission_id Entry ID (0 when unknown).
			 *     @type int    $form_id       Form ID (0 when unknown).
			 *     @type string $audience      'admin' or 'submitter'.
			 *     @type string $step_id       Pipeline step ID.
			 * }
			 * @since 2.1.0
			 */
			$filtered    = apply_filters( 'subtleforms/email/attachments', $attachments, $job );
			$attachments = is_array( $filtered ) ? array_values( array_filter( $filtered, 'is_string' ) ) : $attachments;

			try {
				$sent = \SubtleForms\Support\Mailer::send(
					$job['to'],
					$job['subject'],
					$job['body'],
					$job['headers'] ?? array(),
					$attachments
				);
			} finally {
				/**
				 * Fires after a SubtleForms email was handed to wp_mail, whether
				 * or not it was accepted. Add-ons delete temporary attachments
				 * here.
				 *
				 * @param array    $job         Email job (see subtleforms/email/attachments).
				 * @param string[] $attachments Files that were attached.
				 * @since 2.1.0
				 */
				do_action( 'subtleforms/email/after_send', $job, $attachments );
			}

			if ( ! $sent ) {
				throw new \RuntimeException( 'wp_mail returned false' );
			}

			self::log( 'Email sent successfully', array(
				'to'            => $job['to'],
				'submission_id' => $submission_id ?: null,
			) );
			self::forget( $job );

			// Write completion log back to submissions log table.
			if ( $submission_id > 0 ) {
				$logs = new \SubtleForms\Repositories\LogsRepository();
				$logs->create( array(
					'submission_id' => $submission_id,
					'level'         => 'info',
					'message'       => sprintf( 'Step %s: async_completed', $step_id ),
					'context'       => array(
						'submission_id' => $submission_id,
						'step_id'       => $step_id,
						'action_type'   => 'email',
						'status'        => 'async_completed',
						'data'          => array(
							'to'      => $job['to'],
							'subject' => $job['subject'],
							'sent'    => true,
							'attempt' => $retry_count + 1,
						),
						'ts'            => time(),
					),
				) );
			}

		} catch ( \Throwable $e ) {
			self::log( 'Email execution failed', array(
				'to'            => $job['to'],
				'error'         => $e->getMessage(),
				'retry_count'   => $retry_count,
				'submission_id' => $submission_id ?: null,
			) );

			// Write failure log back to submissions log table.
			if ( $submission_id > 0 ) {
				$logs = new \SubtleForms\Repositories\LogsRepository();
				$logs->create( array(
					'submission_id' => $submission_id,
					'level'         => 'error',
					'message'       => sprintf( 'Step %s: async_failed', $step_id ),
					'context'       => array(
						'submission_id' => $submission_id,
						'step_id'       => $step_id,
						'action_type'   => 'email',
						'status'        => 'async_failed',
						'data'          => array(
							'to'      => $job['to'],
							'subject' => $job['subject'],
							'error'   => $e->getMessage(),
							'attempt' => $retry_count + 1,
						),
						'ts'            => time(),
					),
				) );
			}

			// Retry logic: max 3 attempts
			if ( $retry_count < 3 ) {
				$job['retry_count'] = $retry_count + 1;
				
				// Schedule retry with exponential backoff: 5min, 15min, 30min
				$delays = array( 300, 900, 1800 );
				$delay = $delays[ $retry_count ] ?? 1800;
				
				wp_schedule_single_event(
					time() + $delay,
					'subtleforms_async_email',
					array( self::stash( $job, $delay ) )
				);

				self::log( "Email retry scheduled (#{$job['retry_count']} in {$delay}s)", array(
					'to'            => $job['to'],
					'submission_id' => $submission_id ?: null,
				) );
			} else {
				self::log( 'Email failed after max retries', array(
					'to'            => $job['to'],
					'submission_id' => $submission_id ?: null,
				) );
				self::forget( $job );
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
		$job = self::resolve( $job );
		if ( null === $job ) {
			self::log( 'Webhook job skipped: its stored details expired' );
			return;
		}
		// The stored copy has done its job: it is replaced by a note that the
		// job ran, and written again only if a retry is scheduled.
		self::forget( $job );
		$retry_count   = $job['retry_count'] ?? 0;
		$submission_id = isset( $job['submission_id'] ) ? (int) $job['submission_id'] : 0;
		$step_id       = $job['step_id'] ?? 'webhook';

		try {
			self::log( "Executing webhook job (attempt #{$retry_count})", array(
				'url'           => $job['url'],
				'method'        => $job['method'] ?? 'POST',
				'submission_id' => $submission_id ?: null,
			) );

			$method = strtoupper( $job['method'] ?? 'POST' );

			// The safe client applies the address check to every redirect too
			// (2.4.1), the same check the webhook action made before queueing.
			$response = wp_safe_remote_request(
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

			$code          = wp_remote_retrieve_response_code( $response );
			$response_body = wp_remote_retrieve_body( $response );

			if ( $code >= 400 ) {
				throw new \RuntimeException( "HTTP {$code}: " . wp_remote_retrieve_response_message( $response ) );
			}

			self::log( 'Webhook executed successfully', array(
				'url'           => $job['url'],
				'method'        => $method,
				'status'        => $code,
				'submission_id' => $submission_id ?: null,
			) );
			self::forget( $job );

			// Write completion log back to submissions log table.
			if ( $submission_id > 0 ) {
				$logs = new \SubtleForms\Repositories\LogsRepository();
				$logs->create( array(
					'submission_id' => $submission_id,
					'level'         => 'info',
					'message'       => sprintf( 'Step %s: async_completed', $step_id ),
					'context'       => array(
						'submission_id' => $submission_id,
						'step_id'       => $step_id,
						'action_type'   => 'webhook',
						'status'        => 'async_completed',
						'data'          => array(
							'url'           => $job['url'],
							'method'        => $method,
							'http_status'   => $code,
							'response_body' => substr( $response_body, 0, 500 ),
							'attempt'       => $retry_count + 1,
						),
						'ts'            => time(),
					),
				) );
			}

		} catch ( \Throwable $e ) {
			self::log( 'Webhook execution failed', array(
				'url'           => $job['url'],
				'error'         => $e->getMessage(),
				'retry_count'   => $retry_count,
				'submission_id' => $submission_id ?: null,
			) );

			// Write failure log back to submissions log table.
			if ( $submission_id > 0 ) {
				$logs = new \SubtleForms\Repositories\LogsRepository();
				$logs->create( array(
					'submission_id' => $submission_id,
					'level'         => 'error',
					'message'       => sprintf( 'Step %s: async_failed', $step_id ),
					'context'       => array(
						'submission_id' => $submission_id,
						'step_id'       => $step_id,
						'action_type'   => 'webhook',
						'status'        => 'async_failed',
						'data'          => array(
							'url'     => $job['url'],
							'method'  => strtoupper( $job['method'] ?? 'POST' ),
							'error'   => $e->getMessage(),
							'attempt' => $retry_count + 1,
						),
						'ts'            => time(),
					),
				) );
			}

			// Retries: Settings > Integrations > Webhooks (0 to 5, default 3).
			if ( $retry_count < self::webhookRetries() ) {
				$job['retry_count'] = $retry_count + 1;

				// Growing gaps: 1 min, 5 min, 25 min, 2 hours, 10 hours.
				$delays = array( 60, 300, 1500, 7200, 36000 );
				$delay  = $delays[ $retry_count ] ?? 36000;
				
				wp_schedule_single_event(
					time() + $delay,
					'subtleforms_async_webhook',
					array( self::stash( $job, $delay ) )
				);

				self::log( "Webhook retry scheduled (#{$job['retry_count']} in {$delay}s)", array(
					'url'           => $job['url'],
					'submission_id' => $submission_id ?: null,
				) );
			} else {
				self::log( 'Webhook failed after max retries', array(
					'url'           => $job['url'],
					'submission_id' => $submission_id ?: null,
				) );
				self::forget( $job );
			}
		}
	}

	/**
	 * Option name prefix of the stored job details.
	 */
	const JOB_PREFIX = 'subtleforms_job_';

	/**
	 * How long details of a job that never ran are kept, once its cron event is
	 * gone, before the daily cleanup removes them (seconds).
	 */
	const JOB_ORPHAN_AGE = 7 * DAY_IN_SECONDS;

	/**
	 * Keep a job's details (recipients, body, headers, signature) out of the
	 * cron option. They are stored under the job's id in an option that is not
	 * loaded on every request and never expires (2.8.1: a transient lasted six
	 * hours, and a cron run later than that, or an object cache that evicted
	 * the transient, lost the email). The cron event carries the id and the
	 * fields it needs to find the entry. What the reference already holds, and
	 * the form id (which the entry knows), are not stored again. The copy is
	 * deleted when the job runs; the daily cleanup removes one left behind.
	 *
	 * @param array $job   Full job.
	 * @param int   $delay Unused, kept for callers that pass the retry delay.
	 * @return array Reference job for wp_schedule_single_event().
	 */
	private static function stash( array $job, int $delay = 0 ): array {
		$ref    = (string) ( $job['dispatch_id'] ?? self::dispatchId() );
		$stored = $job;
		unset( $stored['dispatch_id'], $stored['submission_id'], $stored['step_id'], $stored['retry_count'], $stored['step_sig'] );
		if ( ! empty( $job['submission_id'] ) ) {
			unset( $stored['form_id'] );
		}
		// autoload off: a big body must not be read into memory on every request.
		update_option(
			self::JOB_PREFIX . md5( $ref ),
			array(
				'stored_at' => time(),
				'job'       => $stored,
			),
			false
		);
		return array(
			'job_ref'       => $ref,
			'dispatch_id'   => $ref,
			'submission_id' => $job['submission_id'] ?? null,
			'step_id'       => $job['step_id'] ?? '',
			'step_sig'      => $job['step_sig'] ?? '',
			'retry_count'   => $job['retry_count'] ?? 0,
		);
	}

	/**
	 * A short fingerprint of an email step's settings. The cron reference
	 * carries it, so an email built again from the entry is only built from the
	 * step it came from, even when actions were added or removed since.
	 *
	 * @param array $settings Settings of the pipeline step.
	 * @return string
	 */
	public static function stepSignature( array $settings ): string {
		return substr( md5( (string) wp_json_encode( $settings ) ), 0, 16 );
	}

	/**
	 * The stored details of a job: the option, or the transient a job queued
	 * by an earlier version still waits in.
	 *
	 * @param string $ref Job reference.
	 * @return array|null
	 */
	private static function stored( string $ref ): ?array {
		$name  = self::JOB_PREFIX . md5( $ref );
		$value = get_option( $name, null );
		if ( is_array( $value ) && isset( $value['job'] ) && is_array( $value['job'] ) ) {
			return $value['job'];
		}
		if ( is_array( $value ) && ! empty( $value['done'] ) ) {
			return null;
		}
		$legacy = get_transient( $name );
		return is_array( $legacy ) ? $legacy : null;
	}

	/**
	 * Whether the job behind a reference already ran.
	 *
	 * @param string $ref Job reference.
	 * @return bool
	 */
	private static function handled( string $ref ): bool {
		$value = get_option( self::JOB_PREFIX . md5( $ref ), null );
		return is_array( $value ) && ! empty( $value['done'] );
	}

	/**
	 * Load the details behind a reference job (also used by tests). A job queued by an earlier
	 * version carries everything and is returned as it is.
	 *
	 * @param array $job Cron argument.
	 * @return array|null Full job, or null when the stored details are gone.
	 */
	public static function resolve( array $job ): ?array {
		if ( ! isset( $job['job_ref'] ) ) {
			return $job;
		}
		$stored = self::stored( (string) $job['job_ref'] );
		if ( ! is_array( $stored ) ) {
			return null;
		}
		$stored['retry_count']   = $job['retry_count'] ?? 0;
		$stored['dispatch_id']   = $job['dispatch_id'] ?? $job['job_ref'];
		$stored['submission_id'] = $job['submission_id'] ?? null;
		$stored['step_id']       = $job['step_id'] ?? '';
		$stored['step_sig']      = $job['step_sig'] ?? '';
		if ( isset( $stored['audience'] ) && ! isset( $stored['form_id'] ) && ! empty( $stored['submission_id'] ) && class_exists( '\SubtleForms\Repositories\SubmissionsRepository' ) ) {
			$row               = ( new \SubtleForms\Repositories\SubmissionsRepository() )->find( (int) $stored['submission_id'] );
			$stored['form_id'] = (int) ( $row['form_id'] ?? 0 );
		}
		return $stored;
	}

	/**
	 * Build an email again from the saved entry, for a job whose stored
	 * details are gone. Runs the email step of the form's pipeline that the
	 * job came from (its id is in the reference) against the saved answers.
	 * The form as it is now is used, so a step edited or removed since the
	 * entry came in is built from the new settings or not at all.
	 *
	 * @param array $reference Cron argument.
	 * @return array|null Full job, or null when it cannot be built.
	 */
	private static function rebuildEmail( array $reference ): ?array {
		$submission_id = isset( $reference['submission_id'] ) ? (int) $reference['submission_id'] : 0;
		$step_id       = isset( $reference['step_id'] ) ? (string) $reference['step_id'] : '';
		if ( $submission_id <= 0 || '' === $step_id || ! class_exists( '\SubtleForms\Plugin' ) ) {
			return null;
		}
		try {
			$entry = ( new \SubtleForms\Repositories\SubmissionsRepository() )->find( $submission_id );
			if ( ! is_array( $entry ) || ! is_array( $entry['payload'] ?? null ) ) {
				return null;
			}
			$form_id = (int) $entry['form_id'];
			$schema  = \SubtleForms\Engine\FormRestrictions::activeSchema( $form_id );
			if ( ! is_array( $schema ) ) {
				return null;
			}
			$compiler = \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Engine\SchemaCompiler::class );
			$signature = isset( $reference['step_sig'] ) ? (string) $reference['step_sig'] : '';
			foreach ( $compiler->compile( $schema ) as $step ) {
				if ( 'email' !== $step->action()->id() ) {
					continue;
				}
				// Step ids count the actions, so removing an earlier action
				// gives its successor the old id. A job that carries the
				// fingerprint of its step is matched by that; an older one by
				// its id.
				$same = '' !== $signature
					? self::stepSignature( (array) $step->settings() ) === $signature
					: $step->id() === $step_id;
				if ( ! $same ) {
					continue;
				}
				$context = new \SubtleForms\Engine\SubmissionContext( $form_id, $entry['payload'] );
				$context->setMeta( 'submission_id', $submission_id );
				$context->setMeta( 'form_schema', $schema );
				$context->setMeta( 'current_step_id', $step->id() );
				$context->setMeta( 'current_step_settings', $step->settings() );

				self::$captured = array();
				try {
					$step->action()->handle( $context );
					$job = self::$captured;
				} finally {
					self::$captured = null;
				}
				if ( ! is_array( $job ) || empty( $job['to'] ) ) {
					return null;
				}
				$job['retry_count'] = (int) ( $reference['retry_count'] ?? 0 );
				return $job;
			}
		} catch ( \Throwable $e ) {
			self::log( 'Email could not be built again', array( 'error' => $e->getMessage() ) );
		}
		return null;
	}

	/**
	 * Replace a job's stored details with a note that it ran. The note, not
	 * nothing, is what tells a second run of the same event that the email is
	 * sent and must not be built again. The daily cleanup removes it.
	 *
	 * @param array $job Full job.
	 */
	private static function forget( array $job ): void {
		if ( isset( $job['dispatch_id'] ) ) {
			$name = self::JOB_PREFIX . md5( (string) $job['dispatch_id'] );
			update_option(
				$name,
				array(
					'stored_at' => time(),
					'done'      => true,
				),
				false
			);
			// A job queued by an earlier version kept its details in a transient.
			delete_transient( $name );
		}
	}

	/**
	 * Remove stored job details that nothing will use again: notes that a job
	 * ran, a day after it ran, and details older than JOB_ORPHAN_AGE whose cron
	 * event is no longer queued. Details of an event that is still waiting are
	 * kept however old they are, because they are the only complete copy of
	 * the email. Runs from the daily cleanup.
	 *
	 * @return int Rows removed.
	 */
	public static function pruneOrphans(): int {
		global $wpdb;
		$like = $wpdb->esc_like( self::JOB_PREFIX ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Options named by this class's own prefix.
		$rows    = $wpdb->get_results( $wpdb->prepare( "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s", $like ), ARRAY_A );
		$removed = 0;
		$now     = time();
		$waiting = null;
		foreach ( (array) $rows as $row ) {
			$value = maybe_unserialize( $row['option_value'] );
			$at    = is_array( $value ) ? (int) ( $value['stored_at'] ?? 0 ) : 0;
			if ( is_array( $value ) && ! empty( $value['done'] ) ) {
				if ( $at > 0 && $at >= $now - DAY_IN_SECONDS ) {
					continue;
				}
			} else {
				if ( $at > 0 && $at >= $now - self::JOB_ORPHAN_AGE ) {
					continue;
				}
				$waiting = $waiting ?? self::queuedJobOptions();
				if ( isset( $waiting[ $row['option_name'] ] ) ) {
					continue;
				}
			}
			if ( delete_option( $row['option_name'] ) ) {
				++$removed;
			}
		}
		return $removed;
	}

	/**
	 * The option names of the jobs whose cron event is still queued.
	 *
	 * @return array<string,true>
	 */
	private static function queuedJobOptions(): array {
		$names = array();
		$cron  = function_exists( '_get_cron_array' ) ? _get_cron_array() : array();
		foreach ( (array) $cron as $events ) {
			foreach ( array( 'subtleforms_async_email', 'subtleforms_async_webhook' ) as $hook ) {
				foreach ( (array) ( $events[ $hook ] ?? array() ) as $event ) {
					$ref = $event['args'][0]['job_ref'] ?? null;
					if ( is_string( $ref ) && '' !== $ref ) {
						$names[ self::JOB_PREFIX . md5( $ref ) ] = true;
					}
				}
			}
		}
		return $names;
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
		$line        = "[SubtleForms Async] {$message}{$context_str}";
		if ( preg_match( '/fail/i', $message ) ) {
			Logger::error( $line );
			return;
		}
		Logger::info( $line );
	}

	/**
	 * How many times a failed webhook is tried again.
	 *
	 * @return int 0 to 5.
	 */
	public static function webhookRetries(): int {
		$settings = get_option( 'subtleforms_settings', array() );
		$value    = is_array( $settings ) && isset( $settings['ext_webhooks_retries'] ) && is_numeric( $settings['ext_webhooks_retries'] )
			? (int) $settings['ext_webhooks_retries']
			: 3;
		return max( 0, min( 5, $value ) );
	}
}
