<?php
/**
 * Sends entries to the email marketing services after they are saved.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Logger;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Hooks the "entry saved" event, queues one background job per entry and
 * service and, in the job, adds the person to the list the form names. A
 * failure is written to the entry's activity log and never reaches the
 * visitor.
 *
 * Add-ons take part through the `subtleforms/email/marketing/*` hooks
 * documented in docs/hooks.md.
 */
final class Sender {

	/** Entry statuses that are stored but never sent anywhere. */
	const NOT_SENT = array( 'spam', 'failed', 'preview', 'trash' );

	/** Seconds the job waits before it tries again later. */
	const RETRY_DELAYS = array( 120, 900 );

	/**
	 * Listen for saved entries.
	 */
	public static function register(): void {
		add_action( 'subtleforms/submission/completed', array( __CLASS__, 'onSubmission' ), 20, 5 );
	}

	/**
	 * Queue a job for each service the form has on.
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
			$config = Subscriber::normalize( $schema['metadata']['integrations'][ $service ] ?? array(), $service );
			if ( empty( $config['enabled'] ) || ! ( new Connection( $service ) )->isEnabled() || ! Services::coreOwns( $service ) ) {
				continue;
			}
			try {
				AsyncDispatcher::dispatchEmailMarketing(
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
	 * @param array $job { service, submission_id, retry_count, feeds (feed IDs to run; empty for all) }.
	 */
	public static function run( array $job ): void {
		$service      = sanitize_key( (string) ( $job['service'] ?? '' ) );
		$submissionId = (int) ( $job['submission_id'] ?? 0 );
		$retryCount   = max( 0, (int) ( $job['retry_count'] ?? 0 ) );
		$only         = is_array( $job['feeds'] ?? null ) ? array_map( 'strval', $job['feeds'] ) : array();
		if ( ! Services::isBuiltIn( $service ) ) {
			return;
		}

		try {
			$retryFeeds = self::process( $service, $submissionId, $retryCount, $only );
		} catch ( \Throwable $e ) {
			// A bug here must never break the site, only this entry's line.
			Logger::error( '%s job failed for entry %d: %s', $service, $submissionId, $e->getMessage() );
			ActivityLog::record( $submissionId, $service, $service, 'failed', self::failedLine( self::label( $service ), $e->getMessage() ), array( 'error' => $e->getMessage() ) );
			return;
		}

		if ( $retryFeeds && $retryCount < count( self::RETRY_DELAYS ) ) {
			AsyncDispatcher::dispatchEmailMarketing(
				array(
					'service'       => $service,
					'submission_id' => $submissionId,
					'retry_count'   => $retryCount + 1,
					'feeds'         => $retryFeeds,
				),
				self::RETRY_DELAYS[ $retryCount ]
			);
		}
	}

	/**
	 * The name of a service as written in messages.
	 *
	 * @param string $service Service slug.
	 */
	public static function label( string $service ): string {
		return (string) ( Services::definitions()[ $service ]['label'] ?? $service );
	}

	/**
	 * Send one entry to one service. Returns the IDs of feeds worth trying again.
	 *
	 * @param string   $service      Service slug.
	 * @param int      $submissionId Entry ID.
	 * @param int      $retryCount   How many retries came before.
	 * @param string[] $only         Feed IDs to run, or empty for all.
	 * @return string[]
	 */
	public static function process( string $service, int $submissionId, int $retryCount = 0, array $only = array() ): array {
		if ( ! Services::coreOwns( $service ) ) {
			return array();
		}
		$connection = new Connection( $service );
		if ( ! $connection->isEnabled() ) {
			return array();
		}
		$label = self::label( $service );
		$entry = self::loadEntry( $submissionId );
		if ( null === $entry ) {
			return array();
		}
		$base = Subscriber::normalize( $entry['schema']['metadata']['integrations'][ $service ] ?? array(), $service );
		if ( empty( $base['enabled'] ) ) {
			return array();
		}
		if ( in_array( $entry['status'], array( 'spam', 'failed' ), true ) ) {
			/* translators: %s: service name */
			ActivityLog::record( $submissionId, $service, $service, 'skipped', sprintf( __( '%s: skipped (entry is marked as spam or failed)', 'subtleforms' ), $label ), array( 'reason' => 'entry_not_sent' ) );
			return array();
		}
		if ( in_array( $entry['status'], self::NOT_SENT, true ) ) {
			return array();
		}
		if ( ! Services::usable( $service ) ) {
			if ( Services::isLocal( $service ) ) {
				/* translators: 1: service name, 2: why it cannot take people, for example "MailPoet is not active on this site" */
				$line   = sprintf( __( '%1$s: skipped (%2$s)', 'subtleforms' ), $label, MailPoetStatus::reason() );
				$reason = 'not_ready';
			} else {
				/* translators: %s: service name */
				$line   = sprintf( __( '%s: skipped (not connected, add an API key in Settings > Integrations > Email marketing)', 'subtleforms' ), $label );
				$reason = 'not_connected';
			}
			ActivityLog::record( $submissionId, $service, $service, 'skipped', $line, array( 'reason' => $reason ) );
			return array();
		}

		$context = array(
			'service'       => $service,
			'submission_id' => $submissionId,
			'form_id'       => $entry['form_id'],
			'payload'       => $entry['payload'],
			'schema'        => $entry['schema'],
			'entry'         => $entry['row'],
		);

		$default          = $base;
		$default['id']    = 'default';
		$default['label'] = '';

		/**
		 * The feeds to send for an entry to one service. A feed is a set of
		 * settings in the shape of a form's settings for that service
		 * (`list_id`, `fields`, `merge_fields`, `tags`, `double_optin`,
		 * `update_existing`, `consent_field`) with an `id`. This plugin
		 * returns one feed built from the form's own settings. An add-on may
		 * add feeds or change the list. Runs only for forms that have the
		 * service switched on.
		 *
		 * @param array[] $feeds   Feeds, each with a string `id`.
		 * @param array   $context `service`, `submission_id`, `form_id`, `payload`, `schema`, `entry`.
		 * @param string  $service Service slug.
		 * @since 2.8.0
		 */
		$feeds = apply_filters( 'subtleforms/email/marketing/feeds', array( $default ), $context, $service );
		$feeds = is_array( $feeds ) ? $feeds : array( $default );

		$client = Services::clientFor( $service, AbstractClient::JOB_TIMEOUT );
		$retry  = array();
		$seen   = array();
		foreach ( $feeds as $feed ) {
			if ( ! is_array( $feed ) ) {
				continue;
			}
			$feedId = sanitize_key( (string) ( $feed['id'] ?? 'default' ) );
			$feedId = '' === $feedId ? 'default' : $feedId;
			if ( isset( $seen[ $feedId ] ) || ( $only && ! in_array( $feedId, $only, true ) ) ) {
				continue;
			}
			$seen[ $feedId ] = true;
			$feed['id']      = $feedId;
			if ( self::deliver( $client, $service, $feed, $context, $retryCount ) ) {
				$retry[] = $feedId;
			}
		}
		return $retry;
	}

	/**
	 * Send one feed. Returns true when a later attempt could succeed.
	 *
	 * @param ClientInterface $client    Client.
	 * @param string         $service    Service slug.
	 * @param array          $feed       Feed.
	 * @param array          $context    Entry context.
	 * @param int            $retryCount Retries so far.
	 */
	private static function deliver( ClientInterface $client, string $service, array $feed, array $context, int $retryCount ): bool {
		$submissionId = (int) $context['submission_id'];
		$step         = 'default' === $feed['id'] ? $service : $service . ':' . $feed['id'];
		$label        = self::label( $service );

		/**
		 * Skip a feed for this entry. Return a short reason in plain words
		 * (for example "the rule did not match") and the entry's activity log
		 * says "Mailchimp: skipped (reason)". Return null to send.
		 *
		 * @param string|null $reason  Reason, or null.
		 * @param array       $feed    Feed.
		 * @param array       $context Entry context.
		 * @param string      $service Service slug.
		 * @since 2.8.0
		 */
		$reason = apply_filters( 'subtleforms/email/marketing/skip_reason', null, $feed, $context, $service );
		if ( is_string( $reason ) && '' !== trim( $reason ) ) {
			/* translators: 1: service name, 2: reason */
			ActivityLog::record( $submissionId, $service, $step, 'skipped', sprintf( __( '%1$s: skipped (%2$s)', 'subtleforms' ), $label, trim( $reason ) ), array( 'reason' => trim( $reason ) ) );
			return false;
		}

		$built = Subscriber::build( $feed, $context['schema'], $context['payload'], $service );
		if ( null === $built['subscriber'] ) {
			$lines = array(
				/* translators: %s: service name */
				'consent_not_given' => sprintf( __( '%s: skipped (consent not given)', 'subtleforms' ), $label ),
				/* translators: %s: service name */
				'no_email'          => sprintf( __( '%s: skipped (no valid email address in this entry)', 'subtleforms' ), $label ),
			);
			ActivityLog::record( $submissionId, $service, $step, 'skipped', $lines[ $built['skip'] ] ?? sprintf( '%s: skipped', $label ), array( 'reason' => (string) $built['skip'] ) );
			return false;
		}
		$sub = $built['subscriber'];

		/**
		 * Change the subscriber before it is sent: tags from answers, a
		 * different list, extra fields. Return the Subscriber.
		 *
		 * @param Subscriber $subscriber Subscriber.
		 * @param array      $feed       Feed.
		 * @param array      $context    Entry context.
		 * @param string     $service    Service slug.
		 * @since 2.8.0
		 */
		$filtered = apply_filters( 'subtleforms/email/marketing/subscriber', $sub, $feed, $context, $service );
		$sub      = $filtered instanceof Subscriber ? $filtered : $sub;

		try {
			if ( '' === $sub->listId && ! empty( Services::definitions()[ $service ]['list_required'] ) ) {
				// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
				throw new ServiceException(
					sprintf(
						/* translators: %s: service name */
						__( 'No list is chosen in the form\'s %s settings.', 'subtleforms' ),
						$label
					)
				);
				// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			// Only the first attempt asks: a retry follows a half-finished first
			// attempt (the person was added, the tags were not), so a member
			// found then is the one this job created.
			if ( 0 === $retryCount && ! $sub->updateExisting && $client->isMember( $sub->listId, $sub->email ) ) {
				/* translators: %s: service name */
				ActivityLog::record( $submissionId, $service, $step, 'skipped', sprintf( __( '%s: skipped (already in the list)', 'subtleforms' ), $label ), array( 'reason' => 'already_member' ) );
				return false;
			}

			$sent = $client->subscribe(
				$sub,
				static function ( array $body ) use ( $sub, $feed, $context, $service ): array {
					/**
					 * Change the body of the add-or-update request, for example
					 * to add Mailchimp interest groups or marketing permissions.
					 * Return the array.
					 *
					 * @param array      $body       Request body.
					 * @param Subscriber $subscriber Subscriber.
					 * @param array      $feed       Feed.
					 * @param array      $context    Entry context.
					 * @param string     $service    Service slug.
					 * @since 2.8.0
					 */
					$changed = apply_filters( 'subtleforms/email/marketing/request_body', $body, $sub, $feed, $context, $service );
					return is_array( $changed ) ? $changed : $body;
				}
			);
		} catch ( ServiceSkip $e ) {
			// The service knows this person and they must not be subscribed again.
			ActivityLog::record( $submissionId, $service, $step, 'skipped', $e->getMessage(), array( 'reason' => $e->reason() ) );

			/**
			 * A person was left out on purpose, for example someone who
			 * unsubscribed in MailPoet.
			 *
			 * @param string $message Line written to the entry's activity log.
			 * @param string $reason  Short reason: `previously_unsubscribed` or `bounced`.
			 * @param array  $feed    Feed.
			 * @param array  $context Entry context.
			 * @param string $service Service slug.
			 * @since 2.9.0
			 */
			do_action( 'subtleforms/email/marketing/skipped', $e->getMessage(), $e->reason(), $feed, $context, $service );
			return false;
		} catch ( ServiceException $e ) {
			$willRetry = $e->isRetryable() && $retryCount < count( self::RETRY_DELAYS );
			$line      = self::failedLine( $label, $e->getMessage() );
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
				$step,
				'failed',
				$line,
				array(
					'error'       => $e->getMessage(),
					'http_status' => $e->status(),
					'attempt'     => $retryCount + 1,
				)
			);

			/**
			 * A request to an email marketing service failed for an entry.
			 *
			 * @param string $message   Plain reason.
			 * @param array  $feed      Feed.
			 * @param array  $context   Entry context.
			 * @param bool   $willRetry Whether this plugin tries again by itself.
			 * @param string $service   Service slug.
			 * @since 2.8.0
			 */
			do_action( 'subtleforms/email/marketing/failed', $e->getMessage(), $feed, $context, $willRetry, $service );
			return $willRetry;
		}

		$result = array(
			'service' => $service,
			'list'    => $sub->listId,
			'email'   => $sub->email,
			'status'  => $sent['status'],
			'tags'    => $sub->tags ? implode( ', ', $sub->tags ) : '',
			'member'  => $sent['member'],
		);
		ActivityLog::record( $submissionId, $service, $step, 'succeeded', self::resultLine( $label, $sent['status'] ), array_filter( $result, static fn( $v ) => '' !== $v ) );

		/**
		 * A person was added to or updated in a list.
		 *
		 * @param array  $result  `service`, `list`, `email`, `status`, `tags`, `member`.
		 * @param array  $feed    Feed.
		 * @param array  $context Entry context.
		 * @param string $service Service slug.
		 * @since 2.8.0
		 */
		do_action( 'subtleforms/email/marketing/delivered', $result, $feed, $context, $service );
		return false;
	}

	/**
	 * The activity line for a status.
	 *
	 * @param string $label  Service name.
	 * @param string $status subscribed, pending, updated, or another member status the service reports.
	 */
	public static function resultLine( string $label, string $status ): string {
		if ( 'pending' === $status ) {
			/* translators: %s: service name */
			return sprintf( __( '%s: pending (double opt-in)', 'subtleforms' ), $label );
		}
		if ( 'subscribed' === $status || '' === $status ) {
			/* translators: %s: service name */
			return sprintf( __( '%s: subscribed', 'subtleforms' ), $label );
		}
		if ( 'updated' === $status ) {
			/* translators: %s: service name */
			return sprintf( __( '%s: updated', 'subtleforms' ), $label );
		}
		/* translators: 1: service name, 2: member status, for example "unsubscribed" */
		return sprintf( __( '%1$s: updated (status stays %2$s)', 'subtleforms' ), $label, $status );
	}

	/**
	 * The activity line for a failure.
	 *
	 * @param string $label  Service name.
	 * @param string $reason Plain reason.
	 */
	public static function failedLine( string $label, string $reason ): string {
		/* translators: 1: service name, 2: reason */
		return sprintf( __( '%1$s: failed: %2$s', 'subtleforms' ), $label, $reason );
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
