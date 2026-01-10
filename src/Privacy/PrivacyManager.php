<?php
/**
 * SubtleForms Privacy Manager
 *
 * Manages privacy features including data retention and policy text.
 *
 * @package SubtleForms\Privacy
 * @since   1.5.0
 */

namespace SubtleForms\Privacy;

use SubtleForms\Support\Settings;
use SubtleForms\Repositories\SubmissionsRepository;

/**
 * Main privacy manager class.
 */
final class PrivacyManager {

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @param Settings              $settings
	 * @param SubmissionsRepository $submissionsRepo
	 */
	public function __construct( $settings, $submissionsRepo ) {
		$this->settings        = $settings;
		$this->submissionsRepo = $submissionsRepo;
	}

	/**
	 * Initialize privacy features.
	 */
	public function init() {
		// Add privacy policy content
		add_action( 'admin_init', array( $this, 'add_privacy_policy_content' ) );

		// Schedule data retention cleanup
		add_action( 'subtleforms_daily_cleanup', array( $this, 'cleanup_old_submissions' ) );

		// Ensure cron is scheduled
		if ( ! wp_next_scheduled( 'subtleforms_daily_cleanup' ) ) {
			wp_schedule_event( time(), 'daily', 'subtleforms_daily_cleanup' );
		}
	}

	/**
	 * Add privacy policy suggested text.
	 */
	public function add_privacy_policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		$content = $this->get_privacy_policy_text();

		wp_add_privacy_policy_content(
			'SubtleForms',
			wp_kses_post( wpautop( $content, false ) )
		);
	}

	/**
	 * Get privacy policy suggested text.
	 *
	 * @return string
	 */
	private function get_privacy_policy_text() {
		$retention_days = $this->settings->get( 'data_retention_days', 0 );

		$text = __( '<h2>What personal data we collect and why we collect it</h2>', 'subtleforms' );

		$text .= __( '<h3>Contact Forms</h3>', 'subtleforms' );

		$text .= __( '<p>When you submit a form on this website, we collect the information you provide in the form fields. This may include your name, email address, phone number, and any other information you choose to share.</p>', 'subtleforms' );

		$text .= __( '<h3>How long we retain your data</h3>', 'subtleforms' );

		if ( $retention_days > 0 ) {
			$text .= sprintf(
				/* translators: %d: number of days */
				__( '<p>Form submissions are automatically deleted after %d days.</p>', 'subtleforms' ),
				$retention_days
			);
		} else {
			$text .= __( '<p>Form submissions are retained indefinitely unless you request deletion.</p>', 'subtleforms' );
		}

		$text .= __( '<h3>What rights you have over your data</h3>', 'subtleforms' );

		$text .= __( '<p>If you have submitted forms on this site, you can request to receive an exported file of the personal data we hold about you, including any data you have provided to us. You can also request that we erase any personal data we hold about you. This does not include any data we are obliged to keep for administrative, legal, or security purposes.</p>', 'subtleforms' );

		$text .= __( '<h3>Where we send your data</h3>', 'subtleforms' );

		$text .= __( '<p>Form submissions may trigger email notifications which are sent through your web host\'s mail server or a third-party email service if configured.</p>', 'subtleforms' );

		return $text;
	}

	/**
	 * Cleanup old submissions based on retention settings.
	 */
	public function cleanup_old_submissions() {
		$retention_days = (int) $this->settings->get( 'data_retention_days', 0 );

		// If retention is 0, keep forever
		if ( $retention_days <= 0 ) {
			return;
		}

		$deleted = $this->submissionsRepo->delete_older_than( $retention_days );

		if ( $deleted > 0 ) {
			error_log( sprintf( 'SubtleForms: Deleted %d submissions older than %d days', $deleted, $retention_days ) );
		}
	}

	/**
	 * Unschedule cron events on deactivation.
	 */
	public static function deactivate() {
		$timestamp = wp_next_scheduled( 'subtleforms_daily_cleanup' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'subtleforms_daily_cleanup' );
		}
	}
}
