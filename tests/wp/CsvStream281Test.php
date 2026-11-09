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
		$_POST         = array();
		unset( $_SERVER['REQUEST_METHOD'], $_SERVER['HTTP_REFERER'] );
		remove_all_filters( 'wp_redirect' );
		parent::tearDown();
	}

	private function api(): SubmissionsApi {
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		return new SubmissionsApi( new FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
	}

	/** A paragraph of exactly $length characters, different for each entry. */
	private function paragraph( int $i, int $length ): string {
		return substr( str_repeat( 'Entry ' . $i . ' tells the long story of what happened, in plain words. ', (int) ceil( $length / 20 ) + 2 ), 0, $length );
	}

	/** Insert entries $from to $to - 1 in a few queries; every 1000th name is a formula. */
	private function seed( int $formId, int $count, int $from = 0, int $paragraph = 240 ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		$start = strtotime( '2026-01-01 00:00:00 UTC' );
		for ( $batch = $from; $batch < $count; $batch += 500 ) {
			$values = array();
			for ( $i = $batch; $i < min( $count, $batch + 500 ); $i++ ) {
				$name     = 0 === $i % 1000 ? '=HYPERLINK("http://x.test","Person ' . $i . '")' : 'Person ' . $i;
				$values[] = $wpdb->prepare( '(%d, %s, %s, %s)', $formId, wp_json_encode( array( 'name' => $name, 'note' => $this->paragraph( $i, $paragraph ) ) ), 'completed', gmdate( 'Y-m-d H:i:s', $start + intdiv( $i, 3 ) ) );
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

	/**
	 * Write the export to a file on disk (so the file itself does not count
	 * against memory) and report how far memory grew while it was written.
	 *
	 * @return array{growth: int, bytes: int, written: int, chunks: int, file: resource}
	 */
	private function measure( SubmissionsApi $api, int $formId ): array {
		$file   = tmpfile();
		$chunks = 0;
		gc_collect_cycles();
		$before = memory_get_usage();
		memory_reset_peak_usage();
		$written = $api->streamCsv( $formId, array(), $file, function () use ( &$chunks ) { ++$chunks; } );
		$growth  = memory_get_peak_usage() - $before;
		$stat    = fstat( $file );
		return array( 'growth' => $growth, 'bytes' => (int) $stat['size'], 'written' => $written, 'chunks' => $chunks, 'file' => $file );
	}

	public function test_memory_does_not_grow_with_the_number_of_entries_and_the_file_is_right(): void {
		if ( ! function_exists( 'memory_reset_peak_usage' ) ) {
			$this->markTestSkipped( 'Needs PHP 8.2 (memory_reset_peak_usage) to measure the peak of one export.' );
		}
		$id  = $this->form();
		$api = $this->api();
		// A 2,000 character answer in each entry, so one whole copy of the 12,000
		// entry file (about 25 MB) is far more than one chunk of 2,000 entries
		// takes. (At 400 characters the file is 5.6 MB, hardly more than the 5 MB
		// one chunk uses, so memory held for the whole file could not be told
		// from memory held for a chunk.)
		$this->seed( $id, 2000, 0, 2000 );

		// Warm up so one-time caches (schemas, translations) are not counted.
		$warm = fopen( 'php://temp', 'r+' );
		$api->streamCsv( $id, array(), $warm );
		fclose( $warm );

		$small = $this->measure( $api, $id );
		fclose( $small['file'] );
		$this->assertSame( 2000, $small['written'] );

		$this->seed( $id, 12000, 2000, 2000 );
		$large = $this->measure( $api, $id );
		$this->assertSame( 12000, $large['written'] );
		$this->assertGreaterThanOrEqual( 12, $large['chunks'], 'written chunk by chunk, two passes of 6 chunks' );
		$this->assertGreaterThan( 20 * 1024 * 1024, $large['bytes'], 'the file is big enough for memory held for all of it to show' );

		// Flat, not proportional: six times the entries must not cost six times
		// the memory. (A build-it-in-memory export grows by the size of the file.)
		$this->assertLessThan( 1.5 * $small['growth'] + 2 * 1024 * 1024, $large['growth'], 'memory growth at 12,000 entries stays near the growth at 2,000' );
		// And the absolute check. What one chunk takes depends on the database
		// driver (MySQL holds more than SQLite), so the limit is this machine's
		// own growth at 2,000 entries plus a quarter of the file: one whole copy
		// of the file, which is what an export that holds the file or its base64
		// in memory adds on top of a chunk, is over it four times.
		$limit = $small['growth'] + intdiv( $large['bytes'], 4 );
		$this->assertLessThan( $limit, $large['growth'], 'memory stays under one chunk plus a quarter of the file' );

		$file = $large['file'];
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
		$this->assertSame( 2000, strlen( $data[0][5] ), 'the long answer is whole' );
	}

	public function test_the_file_starts_before_the_entries_are_read_for_the_columns(): void {
		$id = $this->form();
		$this->seed( $id, 5 );
		$firstSeen = null;
		$h         = fopen( 'php://temp', 'r+' );
		$this->api()->streamCsv(
			$id,
			array(),
			$h,
			function () use ( &$firstSeen, $h ) {
				if ( null === $firstSeen ) {
					$firstSeen = ftell( $h );
				}
			}
		);
		$this->assertSame( 3, $firstSeen, 'the first thing sent, before any entry is read for the columns, is the byte order mark' );
		rewind( $h );
		$this->assertStringStartsWith( "\xEF\xBB\xBF\"ID\",", stream_get_contents( $h ), 'the heading follows, and the file is the same as before' );
		fclose( $h );
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

	/** Make wp_die throw the response code and a redirect throw its address, instead of ending the request. */
	private function endsAsException(): void {
		add_filter(
			'wp_die_handler',
			static function () {
				return static function ( $message, $title = '', $args = array() ) {
					throw new \RuntimeException( 'die:' . ( is_array( $args ) ? ( $args['response'] ?? 0 ) : 0 ) );
				};
			}
		);
		add_filter(
			'wp_redirect',
			static function ( $location ) {
				throw new \RuntimeException( 'redirect:' . $location );
			}
		);
	}

	/** What a download request ends as: die:<status>, redirect:<address>, or the resolved request. */
	private function download( int $userId, ?string $nonce, array $query = array(), ?string $referer = null ): string {
		wp_set_current_user( $userId );
		$_GET = array_merge( array( 'action' => 'subtleforms_export_csv' ), $query );
		if ( null !== $nonce ) {
			$_GET['_wpnonce'] = $nonce;
		}
		if ( null !== $referer ) {
			$_SERVER['HTTP_REFERER'] = $referer;
		}
		$this->endsAsException();
		try {
			$this->api()->exportRequest();
		} catch ( \RuntimeException $e ) {
			return $e->getMessage();
		}
		return 'served';
	}

	/** A download by POST (the selected entries). */
	private function downloadPost( int $userId, ?string $nonce, array $body, ?string $referer = null, array $query = array() ): string {
		$_SERVER['REQUEST_METHOD'] = 'POST';
		$_POST                     = $body;
		if ( null !== $nonce ) {
			$_POST['_wpnonce'] = $nonce;
		}
		return $this->download( $userId, null, $query, $referer );
	}

	private function user( string $role ): int {
		$id = wp_insert_user( array( 'user_login' => $role . wp_generate_password( 6, false ), 'user_pass' => wp_generate_password(), 'user_email' => $role . wp_generate_password( 6, false ) . '@example.test', 'role' => $role ) );
		$this->userIds[] = $id;
		return $id;
	}

	private function screen(): string {
		return admin_url( 'admin.php?page=subtleforms-submissions&tab=spam' );
	}

	public function test_without_a_screen_to_go_back_to_a_refusal_is_a_plain_error_page(): void {
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );

		$this->assertSame( 'die:403', $this->download( $admin, null ) );
		$this->assertSame( 'die:403', $this->download( $admin, 'notanonce' ) );
		$this->assertSame( 'die:403', $this->download( $admin, wp_create_nonce( 'some_other_action' ) ), 'a nonce for another action is no good' );
		// A valid nonce passes the check; with no entries the next answer is 404, not 403.
		$this->assertSame( 'die:404', $this->download( $admin, $good ) );
		$this->assertSame( 'die:403', $this->download( $this->user( 'subscriber' ), $good ) );
	}

	public function test_a_refusal_goes_back_to_the_screen_with_a_flag_for_the_notice(): void {
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good   = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		$screen = $this->screen();

		// No entries match: sf_export=empty, and the screen (and its tab) is kept.
		$this->assertSame( 'redirect:' . $screen . '&sf_export=empty', $this->download( $admin, $good, array(), $screen ) );
		// A nonce that is old or wrong: sf_export=expired.
		$this->assertSame( 'redirect:' . $screen . '&sf_export=expired', $this->download( $admin, 'notanonce', array(), $screen ) );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=expired', $this->download( $admin, null, array(), $screen ) );
		// No permission: sf_export=forbidden, for a subscriber and for someone signed out.
		$sub = $this->user( 'subscriber' );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=forbidden', $this->download( $sub, $good, array(), $screen ) );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=forbidden', $this->download( 0, $good, array(), $screen ) );
		// A flag from an earlier refusal is replaced, not added to.
		$this->assertSame( 'redirect:' . $screen . '&sf_export=empty', $this->download( $admin, $good, array(), $screen . '&sf_export=expired' ) );
	}

	public function test_a_referer_on_another_site_is_not_gone_back_to(): void {
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		$this->assertSame( 'die:404', $this->download( $admin, $good, array(), 'https://elsewhere.example/admin.php?page=x' ) );
	}

	public function test_a_matching_request_is_resolved_with_its_filters(): void {
		$id = $this->form();
		$this->seed( $id, 3 );
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		$this->assertSame( 'served', $this->download( $admin, $good, array( 'form_id' => (string) $id, 'status' => 'completed' ), $this->screen() ) );
		$this->assertSame( 'redirect:' . $this->screen() . '&sf_export=empty', $this->download( $admin, $good, array( 'form_id' => (string) $id, 'status' => 'spam' ), $this->screen() ) );
	}

	public function test_a_search_for_the_word_all_reaches_the_query(): void {
		$id = $this->form();
		$this->seed( $id, 3 );
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		// Nobody wrote "all": a search for it finds nothing, which is not the same as no search.
		$this->assertSame( 'redirect:' . $this->screen() . '&sf_export=empty', $this->download( $admin, $good, array( 'form_id' => (string) $id, 'search' => 'all' ), $this->screen() ) );
		$this->assertSame( 'served', $this->download( $admin, $good, array( 'form_id' => (string) $id, 'search' => 'Person 1' ), $this->screen() ) );
	}

	public function test_the_selected_entries_are_downloaded_by_post_with_the_same_checks(): void {
		$id = $this->form();
		$this->seed( $id, 6 );
		global $wpdb;
		$all = array_map( 'intval', $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id", $id ) ) );
		$pick = array( (string) $all[1], (string) $all[4] );

		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good   = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		$screen = $this->screen();

		$this->assertSame( 'served', $this->downloadPost( $admin, $good, array( 'ids' => $pick ), $screen ) );
		$request = $this->api()->exportRequest();
		$this->assertSame( array( $all[1], $all[4] ), $request['args']['ids'] );

		// Only those entries are in the file.
		$h = fopen( 'php://temp', 'r+' );
		$this->assertSame( 2, $this->api()->streamCsv( 0, array( 'ids' => array( $all[1], $all[4] ) ), $h ) );
		rewind( $h );
		fread( $h, 3 );
		$rows = array();
		while ( false !== ( $row = fgetcsv( $h, 0, ',', '"', '' ) ) ) {
			$rows[] = $row;
		}
		fclose( $h );
		$this->assertSame( array( (string) $all[4], (string) $all[1] ), array_column( array_slice( $rows, 1 ), 0 ), 'the two chosen entries, newest first' );

		// An empty or useless selection exports nothing; it never means "everything".
		$this->assertSame( 'redirect:' . $screen . '&sf_export=empty', $this->downloadPost( $admin, $good, array( 'ids' => array() ), $screen ) );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=empty', $this->downloadPost( $admin, $good, array( 'ids' => array( '0', 'x', array( 'nested' ) ) ), $screen ) );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=empty', $this->downloadPost( $admin, $good, array(), $screen ) );
		// The nonce is read from the body, not the address.
		$this->assertSame( 'redirect:' . $screen . '&sf_export=expired', $this->downloadPost( $admin, null, array( 'ids' => $pick ), $screen, array( '_wpnonce' => $good ) ), 'a good nonce in the address does not count for a POST' );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=expired', $this->downloadPost( $admin, 'notanonce', array( 'ids' => $pick ), $screen ) );
		$this->assertSame( 'redirect:' . $screen . '&sf_export=forbidden', $this->downloadPost( $this->user( 'subscriber' ), $good, array( 'ids' => $pick ), $screen ) );
	}

	public function test_ids_in_the_address_do_not_narrow_a_get_download(): void {
		$id = $this->form();
		$this->seed( $id, 4 );
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$good = wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION );
		$this->assertSame( 'served', $this->download( $admin, $good, array( 'form_id' => (string) $id, 'ids' => array( '999999' ) ), $this->screen() ) );
		$this->assertArrayNotHasKey( 'ids', $this->api()->exportRequest()['args'] );
	}

	public function test_the_nonce_route_gives_an_administrator_a_nonce_for_the_download(): void {
		$admin = $this->user( 'administrator' );
		wp_set_current_user( $admin );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export-nonce' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status() );
		$nonce = $response->get_data()['data']['nonce'];
		$this->assertNotFalse( wp_verify_nonce( $nonce, SubmissionsApi::EXPORT_NONCE_ACTION ), 'it is a nonce for the download action' );
		$this->assertFalse( wp_verify_nonce( $nonce, 'some_other_action' ) );
	}

	public function test_the_nonce_route_is_for_administrators(): void {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export-nonce' );
		wp_set_current_user( 0 );
		$this->assertContains( rest_do_request( $request )->get_status(), array( 401, 403 ), 'signed out' );
		wp_set_current_user( $this->user( 'subscriber' ) );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$this->assertSame( 403, rest_do_request( $request )->get_status(), 'a subscriber' );
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
