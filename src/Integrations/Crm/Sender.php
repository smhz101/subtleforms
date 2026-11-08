<?php
/**
 * Sends entries to the CRMs after they are saved.
 *
 * @package SubtleForms\Integrations\Crm
 * @since   2.8.1
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Crm;

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Integrations\EmailMarketing\ActivityLog;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\EmailMarketing\Sender as EmailSender;
use SubtleForms\Integrations\EmailMarketing\ServiceException;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Logger;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Hooks the "entry saved" event, queues one background job per entry and
 * CRM and, in the job, creates or updates the contact the form's settings
 * describe. A failure is written to the entry's activity log and never
 * reaches the visitor. It follows the email marketing sender: the same
 * statuses that are never sent, the same retry delays (one retry for a
 * failure worth trying again) and the same activity log.
 *
 * Add-ons take part through the `subtleforms/crm/*` hooks documented in
 * docs/hooks.md.
 */
final class Sender {

	/** Seconds the job waits before it tries again later: one retry. */
	const RETRY_DELAYS = array( 120 );

	/**
	 * Listen for saved entries.
	 */
	public static function register(): void {
		add_action( 'subtleforms/submission/completed', array( __CLASS__, 'onSubmission' ), 21, 5 );
	}

	/**
	 * Queue a job for each CRM the form has on.
	 *
	 * @param mixed $submissionId Entry ID.
	 * @param mixed $formId       Form ID.
	 * @param mixed $payload      Answers.
	 * @param mixed $submission   Stored row.
	 * @param mixed $schema       Active schema.
	 */
	public static function onSubmission( $submissionId, $formId = 0, $payload = array(), $submission = array(), $schema = array() ): void {
		if ( ! is_array( $schema ) || (int) $submissionId <= 0 ) {
			return;
		}
		foreach ( Services::slugs() as $service ) {
			$config = Contact::normalize( $schema['metadata']['integrations'][ $service ] ?? array() );
			if ( empty( $config['enabled'] ) || ! ( new Connection( $service ) )->isEnabled() || ! Services::coreOwns( $service ) ) {
				continue;
			}
			try {
				AsyncDispatcher::dispatchCrm(
					array(
						'service'       => $service,
						'submission_id' => (int) $submissionId,
						'form_id'       => (int) $formId,
					)
				);
			} catch ( \Throwable $e ) {
				Logger::error( '%s job could not be queued for entry %d: %s', $service, (int) $submissionId, $e->getMessage() );
			}
		}
	}

	/**
	 * Run a queued job.
	 *
	 * @param array $job { service, submission_id, retry_count }.
	 */
	public static function run( array $job ): void {
		$service      = sanitize_key( (string) ( $job['service'] ?? '' ) );
		$submissionId = (int) ( $job['submission_id'] ?? 0 );
		$retryCount   = max( 0, (int) ( $job['retry_count'] ?? 0 ) );
		if ( ! Services::isBuiltIn( $service ) ) {
			return;
		}

		try {
			$retry = self::process( $service, $submissionId, $retryCount );
		} catch ( \Throwable $e ) {
			// A bug here must never break the site, only this entry's line.
			Logger::error( '%s job failed for entry %d: %s', $service, $submissionId, $e->getMessage() );
			ActivityLog::record( $submissionId, $service, $service, 'failed', EmailSender::failedLine( self::label( $service ), $e->getMessage() ), array( 'error' => $e->getMessage() ) );
			return;
		}

		if ( $retry && $retryCount < count( self::RETRY_DELAYS ) ) {
			AsyncDispatcher::dispatchCrm(
				array(
					'service'       => $service,
					'submission_id' => $submissionId,
					'retry_count'   => $retryCount + 1,
				),
				self::RETRY_DELAYS[ $retryCount ]
			);
		}
	}

	/**
	 * The name of a CRM as written in messages.
	 *
	 * @param string $service Service slug.
	 */
	public static function label( string $service ): string {
		return (string) ( Services::definitions()[ $service ]['label'] ?? $service );
	}

	/**
	 * Send one entry to one CRM. Returns true when a later attempt could succeed.
	 *
	 * @param string $service      Service slug.
	 * @param int    $submissionId Entry ID.
	 * @param int    $retryCount   How many retries came before.
	 */
	public static function process( string $service, int $submissionId, int $retryCount = 0 ): bool {
		if ( ! Services::coreOwns( $service ) ) {
			return false;
		}
		$connection = new Connection( $service );
		if ( ! $connection->isEnabled() ) {
			return false;
		}
		$label = self::label( $service );
		$entry = self::loadEntry( $submissionId );
		if ( null === $entry ) {
			return false;
		}
		$config = Contact::normalize( $entry['schema']['metadata']['integrations'][ $service ] ?? array() );
		if ( empty( $config['enabled'] ) ) {
			return false;
		}
		if ( in_array( $entry['status'], array( 'spam', 'failed' ), true ) ) {
			/* translators: %s: CRM name */
			ActivityLog::record( $submissionId, $service, $service, 'skipped', sprintf( __( '%s: skipped (entry is marked as spam or failed)', 'subtleforms' ), $label ), array( 'reason' => 'entry_not_sent' ) );
			return false;
		}
		if ( in_array( $entry['status'], EmailSender::NOT_SENT, true ) ) {
			return false;
		}
		if ( ! Services::usable( $service ) ) {
			/* translators: %s: CRM name */
			ActivityLog::record( $submissionId, $service, $service, 'skipped', sprintf( __( '%s: skipped (not connected, add an access token in Settings > Integrations > CRM)', 'subtleforms' ), $label ), array( 'reason' => 'not_connected' ) );
			return false;
		}

		$context = array(
			'service'       => $service,
			'submission_id' => $submissionId,
			'form_id'       => $entry['form_id'],
			'payload'       => $entry['payload'],
			'schema'        => $entry['schema'],
			'entry'         => $entry['row'],
		);
		$feed    = $config;
		$feed['id'] = 'default';

		/**
		 * Skip an entry for a CRM. Return a short reason in plain words (for
		 * example "the rule did not match") and the entry's activity log says
		 * "HubSpot: skipped (reason)". Return null to send. Runs only for
		 * forms that have the CRM switched on.
		 *
		 * @param string|null $reason  Reason, or null.
		 * @param array       $feed    The form's settings for the CRM.
		 * @param array       $context `service`, `submission_id`, `form_id`, `payload`, `schema`, `entry`.
		 * @param string      $service Service slug.
		 * @since 2.8.1
		 */
		$reason = apply_filters( 'subtleforms/crm/skip_reason', null, $feed, $context, $service );
		if ( is_string( $reason ) && '' !== trim( $reason ) ) {
			/* translators: 1: CRM name, 2: reason */
			ActivityLog::record( $submissionId, $service, $service, 'skipped', sprintf( __( '%1$s: skipped (%2$s)', 'subtleforms' ), $label, trim( $reason ) ), array( 'reason' => trim( $reason ) ) );
			return false;
		}

		$built = Contact::build( $config, $entry['schema'], $entry['payload'], $service );
		if ( null === $built['contact'] ) {
			$lines = array(
				/* translators: %s: CRM name */
				'consent_not_given' => sprintf( __( '%s: skipped (consent not given)', 'subtleforms' ), $label ),
				/* translators: %s: CRM name */
				'no_email'          => sprintf( __( '%s: skipped (no valid email address in this entry)', 'subtleforms' ), $label ),
			);
			ActivityLog::record( $submissionId, $service, $service, 'skipped', $lines[ $built['skip'] ] ?? sprintf( '%s: skipped', $label ), array( 'reason' => (string) $built['skip'] ) );
			return false;
		}

		/**
		 * Change the contact before it is sent: a lifecycle stage, an owner,
		 * extra properties. Return the Contact.
		 *
		 * @param Contact $contact Contact.
		 * @param array   $feed    The form's settings for the CRM.
		 * @param array   $context Entry context.
		 * @param string  $service Service slug.
		 * @since 2.8.1
		 */
		$filtered = apply_filters( 'subtleforms/crm/contact', $built['contact'], $feed, $context, $service );
		$contact  = $filtered instanceof Contact ? $filtered : $built['contact'];

		$client = Services::clientFor( $service, HubSpotClient::JOB_TIMEOUT );
		try {
			$sent = $client->saveContact(
				$contact,
				static function ( array $body ) use ( $contact, $feed, $context, $service ): array {
					/**
					 * Change the body of the create-or-update request. Return
					 * the array.
					 *
					 * @param array   $body    Request body.
					 * @param Contact $contact Contact.
					 * @param array   $feed    The form's settings for the CRM.
					 * @param array   $context Entry context.
					 * @param string  $service Service slug.
					 * @since 2.8.1
					 */
					$changed = apply_filters( 'subtleforms/crm/request_body', $body, $contact, $feed, $context, $service );
					return is_array( $changed ) ? $changed : $body;
				}
			);
		} catch ( ServiceException $e ) {
			$willRetry = $e->isRetryable() && $retryCount < count( self::RETRY_DELAYS );
			$line      = EmailSender::failedLine( $label, $e->getMessage() );
			if ( $willRetry ) {
				$line .= ' ' . sprintf(
					/* translators: %d: minutes until the next attempt */
					__( '(trying again in %d minutes)', 'subtleforms' ),
					(int) ( self::RETRY_DELAYS[ $retryCount ] / MINUTE_IN_SECONDS )
				);
			}
			ActivityLog::record(
				$submissionId,
				$service,
				$service,
				'failed',
				$line,
				array(
					'error'       => $e->getMessage(),
					'http_status' => $e->status(),
					'attempt'     => $retryCount + 1,
				)
			);

			/**
			 * A request to a CRM failed for an entry.
			 *
			 * @param string $message   Plain reason.
			 * @param array  $feed      The form's settings for the CRM.
			 * @param array  $context   Entry context.
			 * @param bool   $willRetry Whether this plugin tries again by itself.
			 * @param string $service   Service slug.
			 * @since 2.8.1
			 */
			do_action( 'subtleforms/crm/failed', $e->getMessage(), $feed, $context, $willRetry, $service );
			return $willRetry;
		}

		if ( 'exists' === $sent['result'] ) {
			// "Update existing contacts" is off and HubSpot knows this address.
			ActivityLog::record( $submissionId, $service, $service, 'skipped', self::resultLine( $label, 'exists' ), array( 'reason' => 'already_exists' ) );
			return false;
		}

		$result = array(
			'service'    => $service,
			'email'      => $contact->email,
			'contact_id' => $sent['id'],
			'result'     => $sent['result'],
		);
		ActivityLog::record( $submissionId, $service, $service, 'succeeded', self::resultLine( $label, $sent['result'] ), array_filter( $result, static fn( $v ) => '' !== $v ) );

		/**
		 * A contact was created or updated in a CRM.
		 *
		 * @param array  $result  `service`, `email`, `contact_id`, `result` (created, updated or exists).
		 * @param array  $feed    The form's settings for the CRM.
		 * @param array  $context Entry context.
		 * @param string $service Service slug.
		 * @since 2.8.1
		 */
		do_action( 'subtleforms/crm/delivered', $result, $feed, $context, $service );
		return false;
	}

	/**
	 * The activity line for a result.
	 *
	 * @param string $label  CRM name.
	 * @param string $result created, updated or exists.
	 */
	public static function resultLine( string $label, string $result ): string {
		if ( 'updated' === $result ) {
			/* translators: %s: CRM name */
			return sprintf( __( '%s: contact updated', 'subtleforms' ), $label );
		}
		if ( 'exists' === $result ) {
			/* translators: %s: CRM name */
			return sprintf( __( '%s: skipped (contact already exists)', 'subtleforms' ), $label );
		}
		/* translators: %s: CRM name */
		return sprintf( __( '%s: contact created', 'subtleforms' ), $label );
	}

	/**
	 * Load an entry with its schema.
	 *
	 * @param int $submissionId Entry ID.
	 * @return array{row:array,form_id:int,status:string,payload:array,schema:array}|null
	 */
	private static function loadEntry( int $submissionId ): ?array {
		if ( $submissionId <= 0 ) {
			return null;
		}
		$row = ( new SubmissionsRepository() )->find( $submissionId );
		if ( ! $row ) {
			return null;
		}
		$formId  = (int) ( $row['form_id'] ?? 0 );
		$forms   = new FormsRepository();
		$version = isset( $row['schema_version'] ) && is_numeric( $row['schema_version'] ) ? (int) $row['schema_version'] : null;
		$schema  = array();
		try {
			$loaded = $forms->loadSchemaVersion( $formId, $version );
			if ( ! $loaded && null !== $version ) {
				$loaded = $forms->loadSchemaVersion( $formId );
			}
			$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? $loaded ) : array();
		} catch ( \Throwable $e ) {
			$schema = array();
		}
		return array(
			'row'     => $row,
			'form_id' => $formId,
			'status'  => (string) ( $row['status'] ?? '' ),
			'payload' => is_array( $row['payload'] ?? null ) ? $row['payload'] : array(),
			'schema'  => is_array( $schema ) ? $schema : array(),
		);
	}
}
