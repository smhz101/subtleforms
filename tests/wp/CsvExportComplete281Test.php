<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * The CSV export holds every matching entry (issue 85). It used to stop at
 * the newest 10,000 without saying so.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class CsvExportComplete281Test extends TestCase {

	private function api(): \SubtleForms\Api\SubmissionsApi {
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		return new \SubtleForms\Api\SubmissionsApi( new FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
	}

	/** Insert $count entries in a few queries, several of them in the same second. */
	private function seed( int $formId, int $count ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		$start = strtotime( '2026-01-01 00:00:00 UTC' );
		for ( $from = 0; $from < $count; $from += 500 ) {
			$values = array();
			for ( $i = $from; $i < min( $count, $from + 500 ); $i++ ) {
				// Three entries per second: ties that paging must not mix up.
				$values[] = $wpdb->prepare( '(%d, %s, %s, %s)', $formId, wp_json_encode( array( 'name' => 'Person ' . $i ) ), 'completed', gmdate( 'Y-m-d H:i:s', $start + intdiv( $i, 3 ) ) );
			}
			$wpdb->query( "INSERT INTO {$table} (form_id, payload, status, created_at) VALUES " . implode( ',', $values ) );
		}
	}

	private function export( array $body ): array {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( $body ) );
		return $this->api()->export_submissions_csv( $request )->get_data()['data'];
	}

	private function rows( string $base64 ): array {
		$csv   = substr( base64_decode( $base64 ), 3 ); // Without the BOM.
		$lines = array_values( array_filter( explode( "\r\n", $csv ), 'strlen' ) );
		return array_map( 'str_getcsv', $lines );
	}

	public function test_an_export_of_more_than_ten_thousand_entries_holds_all_of_them(): void {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->seed( $id, 12000 );

		$started = microtime( true );
		$result  = $this->export( array( 'form_id' => $id ) );
		$this->assertLessThan( 10, microtime( true ) - $started, 'the export of 12,000 entries stays fast' );

		$this->assertTrue( $result['success'] );
		$this->assertSame( 12000, $result['total'] );
		$this->assertSame( 12000, $result['rows'] );

		$rows = $this->rows( $result['csv'] );
		$this->assertCount( 12001, $rows, 'a heading and 12,000 entries' );
		$this->assertSame( 'ID', $rows[0][0] );

		$ids = array_column( array_slice( $rows, 1 ), 0 );
		$this->assertCount( 12000, array_unique( $ids ), 'no entry twice, none missing' );
		$names = array_column( array_slice( $rows, 1 ), 4 );
		$this->assertContains( 'Person 0', $names, 'the oldest entry is there' );
		$this->assertContains( 'Person 11999', $names, 'and the newest' );
		$this->assertSame( 'Person 11999', $rows[1][4], 'newest first, as before' );
	}

	public function test_a_filtered_export_and_an_empty_one_still_work(): void {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->seed( $id, 7 );
		$other = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );

		$result = $this->export( array( 'form_id' => $id ) );
		$this->assertSame( 7, $result['total'] );

		$ids  = array_slice( array_column( $this->rows( $result['csv'] ), 0 ), 1, 3 );
		$some = $this->export( array( 'form_id' => $id, 'ids' => array_map( 'intval', $ids ) ) );
		$this->assertSame( 3, $some['total'] );

		$none = $this->export( array( 'form_id' => $other ) );
		$this->assertFalse( $none['success'] );
	}
}
