<?php


/**
 * SubtleForms Privacy Exporter
 *
 * Implements WordPress Privacy API for exporting user data.
 *
 * @package SubtleForms\Privacy
 * @since   1.5.0
 */

namespace SubtleForms\Privacy;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Repositories\FormsRepository;

/**
 * Handles personal data export requests.
 */
final class PrivacyExporter {

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @var FormsRepository
	 */
	private $formsRepo;

	/**
	 * @param SubmissionsRepository $submissionsRepo
	 * @param FormsRepository       $formsRepo
	 */
	public function __construct( $submissionsRepo, $formsRepo ) {
		$this->submissionsRepo = $submissionsRepo;
		$this->formsRepo       = $formsRepo;
	}

	/**
	 * Register the exporter with WordPress.
	 */
	public function register() {
		add_filter(
			'wp_privacy_personal_data_exporters',
			array( $this, 'register_exporter' )
		);
	}

	/**
	 * Register our exporter.
	 *
	 * @param array $exporters Existing exporters.
	 * @return array
	 */
	public function register_exporter( $exporters ) {
		$exporters['subtleforms'] = array(
			'exporter_friendly_name' => __( 'SubtleForms Submissions', 'subtleforms' ),
			'callback'               => array( $this, 'export_user_data' ),
		);

		return $exporters;
	}

	/**
	 * Export user data.
	 *
	 * @param string $email_address Email address to export.
	 * @param int    $page          Page number.
	 * @return array
	 */
	public function export_user_data( $email_address, $page = 1 ) {
		$export_items = array();
		$per_page     = 100;
		$offset       = ( $page - 1 ) * $per_page;

		// Find submissions by email
		$submissions = $this->find_submissions_by_email( $email_address, $per_page, $offset );

		foreach ( $submissions as $submission ) {
			// Get form name
			$form = $this->formsRepo->find( $submission['form_id'] );
			$form_name = $form ? $form['name'] : __( 'Unknown Form', 'subtleforms' );

			// Build export item
			$data = array(
				array(
					'name'  => __( 'Form Name', 'subtleforms' ),
					'value' => $form_name,
				),
				array(
					'name'  => __( 'Submission Date', 'subtleforms' ),
					'value' => $submission['created_at'],
				),
				array(
					'name'  => __( 'Status', 'subtleforms' ),
					'value' => $submission['status'],
				),
			);

			// Add form field data
			$payload = is_string( $submission['payload'] )
				? json_decode( $submission['payload'], true )
				: $submission['payload'];

			if ( is_array( $payload ) ) {
				foreach ( $payload as $field => $value ) {
					// Skip internal fields
					if ( in_array( $field, array( 'website_url', 'form_rendered_at' ), true ) ) {
						continue;
					}

					$data[] = array(
						'name'  => ucwords( str_replace( array( '_', '-' ), ' ', $field ) ),
						'value' => is_array( $value ) ? wp_json_encode( $value ) : $value,
					);
				}
			}

			$export_items[] = array(
				'group_id'    => 'subtleforms-submissions',
				'group_label' => __( 'Form Submissions', 'subtleforms' ),
				'item_id'     => 'submission-' . $submission['id'],
				'data'        => $data,
			);
		}

		$done = count( $submissions ) < $per_page;

		return array(
			'data' => $export_items,
			'done' => $done,
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

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled; query is properly prepared.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE payload LIKE %s ORDER BY created_at DESC LIMIT %d OFFSET %d",
				'%' . $wpdb->esc_like( $email ) . '%',
				$limit,
				$offset
			),
			ARRAY_A
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return $results ?: array();
	}
}
