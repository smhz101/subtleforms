<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Review fixes from PR #27 and #28 (PR #30): CSV export reads every older
 * entry with its own form copy, Repeater columns stay aligned, and a
 * read-only website default given as a bare domain accepts its own value.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\SubmissionsRepository;

final class Review30Test extends TestCase {

	private function legacyEntry( int $formId, array $fields, array $payload ): int {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'subtleforms_submissions',
			array(
				'form_id'    => $formId,
				'payload'    => wp_json_encode( $payload ),
				'meta'       => wp_json_encode( array( 'form_schema' => array( 'fields' => $fields ) ) ),
				'status'     => 'completed',
				'created_at' => current_time( 'mysql', true ),
			)
		);
		return (int) $wpdb->insert_id;
	}

	private function csvRows( int $formId ): array {
		$this->asAdmin();
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		$api  = new \SubtleForms\Api\SubmissionsApi( new \SubtleForms\Repositories\FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId ) ) );
		$csv  = base64_decode( $api->export_submissions_csv( $request )->get_data()['data']['csv'] );
		$csv  = preg_replace( '/^\xEF\xBB\xBF/', '', $csv );
		$rows = array();
		$fh   = fopen( 'php://memory', 'r+' );
		fwrite( $fh, $csv );
		rewind( $fh );
		while ( false !== ( $row = fgetcsv( $fh ) ) ) {
			$rows[] = $row;
		}
		fclose( $fh );
		return $rows;
	}

	private function select( string $label ): array {
		return array( 'type' => 'select', 'key' => 'pick', 'label' => 'Pick', 'options' => array( array( 'label' => $label, 'value' => 'a' ) ) );
	}

	/** Two older entries without a schema version are each read with their own copy. */
	public function test_legacy_entries_use_their_own_form_copy_in_csv() {
		$formId = $this->publish( array( array_merge( $this->select( 'Now A' ), array( 'id' => 'pick' ) ) ) );
		$this->legacyEntry( $formId, array( $this->select( 'Old A' ) ), array( 'pick' => 'a' ) );
		$this->legacyEntry( $formId, array( $this->select( 'Older A' ) ), array( 'pick' => 'a' ) );

		$cells = array_merge( ...$this->csvRows( $formId ) );
		$this->assertContains( 'Old A', $cells );
		$this->assertContains( 'Older A', $cells );
	}

	/** A Repeater child added since an entry was made leaves its cell empty; the others do not shift. */
	public function test_repeater_columns_stay_aligned_across_versions() {
		$now  = array(
			'id'       => 'r',
			'key'      => 'r',
			'type'     => 'repeat_container',
			'label'    => 'R',
			'children' => array(
				array( 'id' => 'x', 'key' => 'x', 'type' => 'text', 'label' => 'X' ),
				array( 'id' => 'y', 'key' => 'y', 'type' => 'select', 'label' => 'Y', 'options' => array( array( 'label' => 'Now B', 'value' => 'b' ) ) ),
			),
		);
		$then = array(
			'key'      => 'r',
			'type'     => 'repeat_container',
			'label'    => 'R',
			'children' => array(
				array( 'key' => 'y', 'type' => 'select', 'label' => 'Y', 'options' => array( array( 'label' => 'Then B', 'value' => 'b' ) ) ),
			),
		);
		$formId = $this->publish( array( $now ) );
		$this->legacyEntry( $formId, array( $then ), array( 'r' => array( array( 'y' => 'b' ) ) ) );

		$rows    = $this->csvRows( $formId );
		$headers = $rows[0];
		$xCol    = array_search( 'R: X', $headers, true );
		$yCol    = array_search( 'R: Y', $headers, true );
		$this->assertNotFalse( $xCol, wp_json_encode( $headers ) );
		$this->assertNotFalse( $yCol, wp_json_encode( $headers ) );
		$this->assertSame( '', $rows[1][ $xCol ] );
		$this->assertSame( 'Then B', $rows[1][ $yCol ] );
		$this->assertCount( count( $headers ), $rows[1] );
	}
}
