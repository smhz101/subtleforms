<?php
/**
 * SubtleForms Privacy Eraser
 *
 * Implements WordPress Privacy API for erasing user data.
 *
 * @package SubtleForms\Privacy
 * @since   1.5.0
 */

namespace SubtleForms\Privacy;

use SubtleForms\Repositories\SubmissionsRepository;

/**
 * Handles personal data erasure requests.
 */
final class PrivacyEraser {

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @param SubmissionsRepository $submissionsRepo
	 */
	public function __construct( $submissionsRepo ) {
		$this->submissionsRepo = $submissionsRepo;
	}

	/**
	 * Register the eraser with WordPress.
	 */
	public function register() {
		add_filter(
			'wp_privacy_personal_data_erasers',
			array( $this, 'register_eraser' )
		);
	}

	/**
	 * Register our eraser.
	 *
	 * @param array $erasers Existing erasers.
	 * @return array
	 */
	public function register_eraser( $erasers ) {
		$erasers['subtleforms'] = array(
			'eraser_friendly_name' => __( 'SubtleForms Submissions', 'subtleforms' ),
			'callback'             => array( $this, 'erase_user_data' ),
		);

		return $erasers;
	}

	/**
	 * Erase user data.
	 *
	 * @param string $email_address Email address to erase.
	 * @param int    $page          Page number.
	 * @return array
	 */
	public function erase_user_data( $email_address, $page = 1 ) {
		$items_removed  = false;
		$items_retained = false;
		$messages       = array();
		$per_page       = 100;
		$offset         = ( $page - 1 ) * $per_page;

		// Find submissions by email
		$submissions = $this->find_submissions_by_email( $email_address, $per_page, $offset );

		foreach ( $submissions as $submission ) {
			try {
				// Delete submission
				$deleted = $this->submissionsRepo->delete( $submission['id'] );

				if ( $deleted ) {
					$items_removed = true;
				} else {
					$items_retained = true;
					$messages[]     = sprintf(
						/* translators: %d: submission ID */
						__( 'Failed to delete submission #%d', 'subtleforms' ),
						$submission['id']
					);
				}
			} catch ( \Exception $e ) {
				$items_retained = true;
				$messages[]     = sprintf(
					/* translators: 1: submission ID, 2: error message */
					__( 'Error deleting submission #%1$d: %2$s', 'subtleforms' ),
					$submission['id'],
					$e->getMessage()
				);
			}
		}

		$done = count( $submissions ) < $per_page;

		return array(
			'items_removed'  => $items_removed,
			'items_retained' => $items_retained,
			'messages'       => $messages,
			'done'           => $done,
		);
	}

	/**
	 * Find submissions by email address.
	 *
	 * @param string $email   Email address.
	 * @param int    $limit   Number of results.
	 * @param int    $offset  Offset for pagination.
	 * @return array
	 */
	private function find_submissions_by_email( $email, $limit = 100, $offset = 0 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- Table name is safe, direct query needed.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, form_id FROM {$table} WHERE payload LIKE %s ORDER BY created_at DESC LIMIT %d OFFSET %d",
				'%' . $wpdb->esc_like( $email ) . '%',
				$limit,
				$offset
			),
			ARRAY_A
		);

		return $results ?: array();
	}
}
