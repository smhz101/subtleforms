<?php
/**
 * Sends entries to Mailchimp after they are saved.
 *
 * @package SubtleForms\Integrations\Mailchimp
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Mailchimp;

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Integrations\Registry;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Logger;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Hooks the "entry saved" event, queues one background job per entry and, in
 * the job, adds the person to the audience the form names. A failure is
 * written to the entry's activity log and never reaches the visitor.
 *
 * Add-ons take part through the `subtleforms/mailchimp/*` hooks documented in
 * docs/hooks.md.
 */
final class Sender {

	/** Entry statuses that are stored but never sent anywhere. */
	const NOT_SENT = array( 'spam', 'failed', 'preview', 'trash' );

	/** Longest the job waits on Mailchimp before it tries again later. */
	const RETRY_DELAYS = array( 120, 900 );

	/**
	 * Listen for saved entries.
	 */
	public static function register(): void {
		add_action( 'subtleforms/submission/completed', array( __CLASS__, 'onSubmission' ), 20, 5 );
	}

	/**
	 * Queue the job when the form has Mailchimp on.
	 *
	 * @param mixed $submissionId Entry ID.
	 * @param mixed $formId       Form ID.
	 * @param mixed $payload      Answers.
	 * @param mixed $submission   Stored row.
	 * @param mixed $schema       Active schema.
	 */
	public static function onSubmission( $submissionId, $formId = 0, $payload = array(), $submission = array(), $schema = array() ): void {
		$config = is_array( $schema ) ? Subscriber::normalize( $schema['metadata']['integrations']['mailchimp'] ?? array() ) : array( 'enabled' => false );
		if ( empty( $config['enabled'] ) || (int) $submissionId <= 0 ) {
			return;
		}
		if ( ! Registry::coreOwnsMailchimp() ) {
			return;
		}
		try {
			AsyncDispatcher::dispatchMailchimp(
				array(
					'submission_id' => (int) $submissionId,
					'form_id'       => (int) $formId,
				)
			);
		} catch ( \Throwable $e ) {
			Logger::error( 'Mailchimp job could not be queued for entry %d: %s', (int) $submissionId, $e->getMessage() );
		}
	}

	/**
	 * Run a queued job.
	 *
	 * @param array $job { submission_id, retry_count, feeds (feed IDs to run; empty for all) }.
	 */
	public static function run( array $job ): void {
		$submissionId = (int) ( $job['submission_id'] ?? 0 );
		$retryCount   = max( 0, (int) ( $job['retry_count'] ?? 0 ) );
		$only         = is_array( $job['feeds'] ?? null ) ? array_map( 'strval', $job['feeds'] ) : array();

		try {
			$retryFeeds = self::process( $submissionId, $retryCount, $only );
		} catch ( \Throwable $e ) {
			// A bug here must never break the site, only this entry's line.
			Logger::error( 'Mailchimp job failed for entry %d: %s', $submissionId, $e->getMessage() );
			ActivityLog::record( $submissionId, 'mailchimp', 'failed', self::failedLine( $e->getMessage() ), array( 'error' => $e->getMessage() ) );
			return;
		}

		if ( $retryFeeds && $retryCount < count( self::RETRY_DELAYS ) ) {
			AsyncDispatcher::dispatchMailchimp(
				array(
					'submission_id' => $submissionId,
					'retry_count'   => $retryCount + 1,
					'feeds'         => $retryFeeds,
				),
				self::RETRY_DELAYS[ $retryCount ]
			);
		}
	}

	/**
	 * Send one entry. Returns the IDs of feeds worth trying again.
	 *
	 * @param int      $submissionId Entry ID.
	 * @param int      $retryCount   How many retries came before.
	 * @param string[] $only         Feed IDs to run, or empty for all.
	 * @return string[]
	 */
	public static function process( int $submissionId, int $retryCount = 0, array $only = array() ): array {
		if ( ! Registry::coreOwnsMailchimp() ) {
			return array();
		}
		$entry = self::loadEntry( $submissionId );
		if ( null === $entry ) {
			return array();
		}
		$base = Subscriber::normalize( $entry['schema']['metadata']['integrations']['mailchimp'] ?? array() );
		if ( empty( $base['enabled'] ) ) {
			return array();
		}
		if ( in_array( $entry['status'], array( 'spam', 'failed' ), true ) ) {
			ActivityLog::record( $submissionId, 'mailchimp', 'skipped', __( 'Mailchimp: skipped (entry is marked as spam or failed)', 'subtleforms' ), array( 'reason' => 'entry_not_sent' ) );
			return array();
		}
		if ( in_array( $entry['status'], self::NOT_SENT, true ) ) {
			return array();
		}
		if ( ! Connection::hasKey() ) {
			ActivityLog::record( $submissionId, 'mailchimp', 'skipped', __( 'Mailchimp: skipped (not connected, add an API key in Settings > Integrations > Mailchimp)', 'subtleforms' ), array( 'reason' => 'not_connected' ) );
			return array();
		}

		$context = array(
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
		 * The Mailchimp feeds to send for an entry. A feed is a set of
		 * settings in the shape of a form's Mailchimp settings
		 * (`list_id`, `fields`, `merge_fields`, `tags`, `double_optin`,
		 * `update_existing`, `consent_field`) with an `id`. This plugin
		 * returns one feed built from the form's own settings. An add-on may
		 * add feeds or change the list. Runs only for forms that have
		 * Mailchimp switched on.
		 *
		 * @param array[] $feeds   Feeds, each with a string `id`.
		 * @param array   $context `submission_id`, `form_id`, `payload`, `schema`, `entry`.
		 * @since 2.8.0
		 */
		$feeds = apply_filters( 'subtleforms/mailchimp/feeds', array( $default ), $context );
		$feeds = is_array( $feeds ) ? $feeds : array( $default );

		$client = new Client( Connection::apiKey(), Client::JOB_TIMEOUT );
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
			if ( self::deliver( $client, $feed, $context, $retryCount ) ) {
				$retry[] = $feedId;
			}
		}
		return $retry;
	}

	/**
	 * Send one feed. Returns true when a later attempt could succeed.
	 *
	 * @param Client $client     Client.
	 * @param array  $feed       Feed.
	 * @param array  $context    Entry context.
	 * @param int    $retryCount Retries so far.
	 */
	private static function deliver( Client $client, array $feed, array $context, int $retryCount ): bool {
		$submissionId = (int) $context['submission_id'];
		$step         = 'default' === $feed['id'] ? 'mailchimp' : 'mailchimp:' . $feed['id'];

		/**
		 * Skip a feed for this entry. Return a short reason in plain words
		 * (for example "the rule did not match") and the entry's activity log
		 * says "Mailchimp: skipped (reason)". Return null to send.
		 *
		 * @param string|null $reason  Reason, or null.
		 * @param array       $feed    Feed.
		 * @param array       $context Entry context.
		 * @since 2.8.0
		 */
		$reason = apply_filters( 'subtleforms/mailchimp/skip_reason', null, $feed, $context );
		if ( is_string( $reason ) && '' !== trim( $reason ) ) {
			/* translators: %s: reason */
			ActivityLog::record( $submissionId, $step, 'skipped', sprintf( __( 'Mailchimp: skipped (%s)', 'subtleforms' ), trim( $reason ) ), array( 'reason' => trim( $reason ) ) );
			return false;
		}

		$built = Subscriber::build( $feed, $context['schema'], $context['payload'] );
		if ( null === $built['subscriber'] ) {
			$lines = array(
				'consent_not_given' => __( 'Mailchimp: skipped (consent not given)', 'subtleforms' ),
				'no_email'          => __( 'Mailchimp: skipped (no valid email address in this entry)', 'subtleforms' ),
			);
			ActivityLog::record( $submissionId, $step, 'skipped', $lines[ $built['skip'] ] ?? __( 'Mailchimp: skipped', 'subtleforms' ), array( 'reason' => (string) $built['skip'] ) );
			return false;
		}
		$sub = $built['subscriber'];

		/**
		 * Change the subscriber before it is sent: tags from answers, a
		 * different audience, extra merge fields. Return the Subscriber.
		 *
		 * @param Subscriber $subscriber Subscriber.
		 * @param array      $feed       Feed.
		 * @param array      $context    Entry context.
		 * @since 2.8.0
		 */
		$filtered = apply_filters( 'subtleforms/mailchimp/subscriber', $sub, $feed, $context );
		$sub      = $filtered instanceof Subscriber ? $filtered : $sub;

		try {
			if ( '' === $sub->listId ) {
				// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
				throw new MailchimpException( __( 'No audience is chosen in the form\'s Mailchimp settings.', 'subtleforms' ) );
				// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( ! $sub->updateExisting && $client->isMember( $sub->listId, $sub->email ) ) {
				ActivityLog::record( $submissionId, $step, 'skipped', __( 'Mailchimp: skipped (already in the audience)', 'subtleforms' ), array( 'reason' => 'already_member' ) );
				return false;
			}

			$request = $client->upsertRequest( $sub );

			/**
			 * Change the body of the add-or-update request, for example to add
			 * interest groups or marketing permissions. Return the array.
			 *
			 * @param array      $body       Request body.
			 * @param Subscriber $subscriber Subscriber.
			 * @param array      $feed       Feed.
			 * @param array      $context    Entry context.
			 * @since 2.8.0
			 */
			$body            = apply_filters( 'subtleforms/mailchimp/member_body', $request['body'], $sub, $feed, $context );
			$request['body'] = is_array( $body ) ? $body : $request['body'];

			$response = $client->send( $request );
			$status   = (string) ( $response['body']['status'] ?? '' );

			if ( $sub->tags ) {
				$client->send( $client->tagsRequest( $sub ) );
			}
		} catch ( MailchimpException $e ) {
			$willRetry = $e->isRetryable() && $retryCount < count( self::RETRY_DELAYS );
			$line      = self::failedLine( $e->getMessage() );
			if ( $willRetry ) {
				$line .= ' ' . sprintf(
					/* translators: %d: minutes until the next attempt */
					__( '(trying again in %d minutes)', 'subtleforms' ),
					(int) ( self::RETRY_DELAYS[ $retryCount ] / MINUTE_IN_SECONDS )
				);
			}
			ActivityLog::record(
				$submissionId,
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
			 * A Mailchimp request for an entry failed.
			 *
			 * @param string $message Plain reason.
			 * @param array  $feed    Feed.
			 * @param array  $context Entry context.
			 * @param bool   $willRetry Whether this plugin tries again by itself.
			 * @since 2.8.0
			 */
			do_action( 'subtleforms/mailchimp/failed', $e->getMessage(), $feed, $context, $willRetry );
			return $willRetry;
		}

		$result = array(
			'audience' => $sub->listId,
			'email'    => $sub->email,
			'status'   => $status,
			'tags'     => $sub->tags ? implode( ', ', $sub->tags ) : '',
			'member'   => (string) ( $response['body']['id'] ?? Client::subscriberHash( $sub->email ) ),
		);
		ActivityLog::record( $submissionId, $step, 'succeeded', self::resultLine( $status ), array_filter( $result, static fn( $v ) => '' !== $v ) );

		/**
		 * A person was added to or updated in an audience.
		 *
		 * @param array $result  `audience`, `email`, `status`, `tags`, `member`.
		 * @param array $feed    Feed.
		 * @param array $context Entry context.
		 * @since 2.8.0
		 */
		do_action( 'subtleforms/mailchimp/delivered', $result, $feed, $context );
		return false;
	}

	/**
	 * The activity line for a Mailchimp member status.
	 *
	 * @param string $status Status in Mailchimp's answer.
	 */
	public static function resultLine( string $status ): string {
		if ( 'pending' === $status ) {
			return __( 'Mailchimp: pending (double opt-in)', 'subtleforms' );
		}
		if ( 'subscribed' === $status || '' === $status ) {
			return __( 'Mailchimp: subscribed', 'subtleforms' );
		}
		/* translators: %s: member status in Mailchimp, for example "unsubscribed" */
		return sprintf( __( 'Mailchimp: updated (status stays %s)', 'subtleforms' ), $status );
	}

	/**
	 * The activity line for a failure.
	 *
	 * @param string $reason Plain reason.
	 */
	public static function failedLine( string $reason ): string {
		/* translators: %s: reason */
		return sprintf( __( 'Mailchimp: failed: %s', 'subtleforms' ), $reason );
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
