<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * The CSV export is streamed to a file instead of built in memory (issue 95).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Api\SubmissionsApi;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class CsvStream281Test extends TestCase {

	/** @var int[] */
	private $userIds = array();

	protected function tearDown(): void {
		remove_all_filters( 'wp_die_handler' );
		foreach ( $this->userIds as $id ) {
			wp_delete_user( $id );
		}
		$this->userIds = array();
		$_GET          = array();
		parent::tearDown();
	}

	private function api(): SubmissionsApi {
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		return new SubmissionsApi( new FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
	}

	/** Insert $count entries in a few queries; every 1000th answer is a formula. */
	private function seed( int $formId, int $count ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		$start = strtotime( '2026-01-01 00:00:00 UTC' );
		for ( $from = 0; $from < $count; $from += 500 ) {
			$values = array();
			for ( $i = $from; $i < min( $count, $from + 500 ); $i++ ) {
				$name     = 0 === $i % 1000 ? '=HYPERLINK("http://x.test","Person ' . $i . '")' : 'Person ' . $i;
				$values[] = $wpdb->prepare( '(%d, %s, %s, %s)', $formId, wp_json_encode( array( 'name' => $name, 'note' => str_repeat( 'long answer ', 20 ) ) ), 'completed', gmdate( 'Y-m-d H:i:s', $start + intdiv( $i, 3 ) ) );
			}
			$wpdb->query( "INSERT INTO {$table} (form_id, payload, status, created_at) VALUES " . implode( ',', $values ) );
		}
	}

	private function form(): int {
		return $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'o', 'key' => 'note', 'type' => 'text', 'label' => 'Note' ),
			)
		);
	}

	public function test_twelve_thousand_entries_stream_with_flat_memory_and_escaped_formulas(): void {
		$id = $this->form();
		$this->seed( $id, 12000 );
		$api = $this->api();

		// Warm up so one-time caches (schemas, translations) are not counted.
		$warm = fopen( 'php://temp', 'r+' );
		$api->streamCsv( $id, array(), $warm );
		fclose( $warm );

		$file   = tmpfile(); // On disk: the stream itself must not count against memory.
		$chunks = 0;
		gc_collect_cycles();
		$before = memory_get_usage();
		if ( function_exists( 'memory_reset_peak_usage' ) ) {
			memory_reset_peak_usage();
		}
		$written = $api->streamCsv( $id, array(), $file, function () use ( &$chunks ) { ++$chunks; } );
		$growth  = memory_get_peak_usage() - $before;

		$this->assertSame( 12000, $written );
		$this->assertLessThan( 16 * 1024 * 1024, $growth, 'memory stays flat while 12,000 entries are written' );
		$this->assertGreaterThanOrEqual( 12, $chunks, 'written chunk by chunk, two passes of 6 chunks' );

		rewind( $file );
		$this->assertSame( "\xEF\xBB\xBF", fread( $file, 3 ), 'UTF-8 BOM first' );
		$rows = array();
		while ( false !== ( $row = fgetcsv( $file, 0, ',', '"', '' ) ) ) {
			$rows[] = $row;
		}
		fclose( $file );

		$this->assertCount( 12001, $rows, 'a heading and 12,000 entries' );
		$this->assertSame( array( 'ID', 'Form ID', 'Status', 'Submitted At', 'Name', 'Note' ), $rows[0] );
		$data = array_slice( $rows, 1 );
		$this->assertCount( 12000, array_unique( array_column( $data, 0 ) ), 'no entry twice, none missing' );
		$names = array_column( $data, 4 );
		$this->assertContains( 'Person 1', $names );
		$this->assertContains( "'=HYPERLINK(\"http://x.test\",\"Person 0\")", $names, 'a formula is stored as text' );
		foreach ( $names as $name ) {
			$this->assertStringStartsNotWith( '=', $name, 'no cell starts with =' );
		}
	}

	public function test_the_filters_apply_and_an_empty_export_writes_nothing(): void {
		$id = $this->form();
		$this->seed( $id, 9 );
		$other = $this->form();
		$api   = $this->api();

		$h = fopen( 'php://temp', 'r+' );
		$this->assertSame( 9, $api->streamCsv( $id, array( 'status' => 'completed' ), $h ) );
		fclose( $h );

		$h = fopen( 'php://temp', 'r+' );
		$this->assertSame( 0, $api->streamCsv( $id, array( 'status' => 'spam' ), $h ) );
		$this->assertSame( 0, $api->streamCsv( $other, array(), $h ) );
		rewind( $h );
		$this->assertSame( '', stream_get_contents( $h ), 'nothing is written when nothing matches' );
		fclose( $h );
	}

	/** Make wp_die throw the response code instead of ending the request. */
	private function dieAsException(): void {
		add_filter(
			'wp_die_handler',
			static function () {
				return static function ( $message, $title = '', $args = array() ) {
					throw new \RuntimeException( 'die:' . ( is_array( $args ) ? ( $args['response'] ?? 0 ) : 0 ) );
				};
			}
		);
	}

	private function download( int $userId, ?string $nonce ): string {
		wp_set_current_user( $userId );
		$_GET = array( 'action' => 'subtleforms_export_csv' );
		if ( null !== $nonce ) {
			$_GET['_wpnonce'] = $nonce;
		}
		$this->dieAsException();
		try {
			$this->api()->downloadCsv();
		} catch ( \RuntimeException $e ) {
			return $e->getMessage();
		}
		return 'served';
	}

	private function user( string $role ): int {
		$id = wp_insert_user( array( 'user_login' => $role . wp_generate_password( 6, false ), 'user_pass' => wp_generate_password(), 'user_email' => $role . wp_generate_password( 6, false ) . '@example.test', 'role' => $role ) );
		$this->userIds[] = $id;
		return $id;
	}

	public function test_a_missing_or_bad_nonce_is_refused_with_403(): void {
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );

		$this->assertSame( 'die:403', $this->download( $admin, null ) );
		$this->assertSame( 'die:403', $this->download( $admin, 'notanonce' ) );
		$this->assertSame( 'die:403', $this->download( $admin, wp_create_nonce( 'some_other_action' ) ), 'a nonce for another action is no good' );
		// A valid nonce passes the check; with no entries the next answer is 404, not 403.
		$this->assertSame( 'die:404', $this->download( $admin, $good ) );
	}

	public function test_a_subscriber_is_refused_with_403_even_with_a_valid_nonce(): void {
		$sub = $this->user( 'subscriber' );
		wp_set_current_user( $sub );
		$nonce = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		$this->assertSame( 'die:403', $this->download( $sub, $nonce ) );
		$this->assertSame( 'die:403', $this->download( 0, $nonce ), 'and a visitor who is not signed in' );
	}

	public function test_the_json_export_still_answers_for_add_ons(): void {
		$id = $this->form();
		$this->seed( $id, 5 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $id ) ) );
		$data = $this->api()->export_submissions_csv( $request )->get_data()['data'];
		$this->assertTrue( $data['success'] );
		$this->assertSame( 5, $data['rows'] );
		$this->assertSame( 5, $data['total'] );
		$this->assertStringStartsWith( "\xEF\xBB\xBF\"ID\"", base64_decode( $data['csv'] ) );
	}
}
