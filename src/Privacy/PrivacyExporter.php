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

		// Entries whose answers hold exactly this address (FF-21), entries sent
		// while logged in to its account, and anonymous entries stored with
		// the same IP address. Each page continues from the last entry id.
		$found       = PrivacyLookup::page( (string) $email_address, (int) $page, $per_page );
		$submissions = array_values( array_filter( array_map( array( $this->submissionsRepo, 'find' ), $found['ids'] ) ) );

		foreach ( $submissions as $submission ) {
			// Get form name
			$form = $this->formsRepo->find( $submission['form_id'] );
			$form_name = $form ? ( $form['title'] ?? '' ) : __( 'Unknown Form', 'subtleforms' );

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

			// What was recorded about the visit.
			foreach ( array(
				'ip_address' => __( 'IP address', 'subtleforms' ),
				'user_agent' => __( 'Browser', 'subtleforms' ),
			) as $column => $label ) {
				if ( ! empty( $submission[ $column ] ) ) {
					$data[] = array(
						'name'  => $label,
						'value' => $submission[ $column ],
					);
				}
			}
			if ( ! empty( $submission['user_id'] ) ) {
				$data[] = array(
					'name'  => __( 'User ID', 'subtleforms' ),
					'value' => (int) $submission['user_id'],
				);
			}

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

		return array(
			'data' => $export_items,
			'done' => $found['done'],
		);
	}
}
