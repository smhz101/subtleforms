<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * The CSV export reads a Submissions tab the way the list does (issue 133):
 * Starred, Unread and Read are columns, not statuses.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Api\SubmissionsApi;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class ExportTabs133Test extends TestCase {

	/** @var int[] */
	private $userIds = array();

	/** @var int */
	private $formId = 0;

	/** @var array<string,int> label => entry id */
	private $ids = array();

	protected function tearDown(): void {
		foreach ( $this->userIds as $id ) {
			wp_delete_user( $id );
		}
		$this->userIds = array();
		$_GET          = array();
		remove_all_filters( 'wp_redirect' );
		unset( $_SERVER['HTTP_REFERER'] );
		parent::tearDown();
	}

	private function api(): SubmissionsApi {
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		return new SubmissionsApi( new FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
	}

	/**
	 * Seven entries of one form:
	 *   a: unread, starred       b: unread           c: read, starred
	 *   d: read                  e: read, spam       f: unread, spam, starred
	 *   g: unread, trash
	 * Spam shows only in the Spam tab (issue 131).
	 */
	private function seed(): void {
		global $wpdb;
		$this->formId = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$rows         = array(
			'a' => array( 'completed', 0, 1, 'Khan Ali' ),
			'b' => array( 'completed', 0, 0, 'Ahmed' ),
			'c' => array( 'completed', 1, 1, 'Khan Sara' ),
			'd' => array( 'completed', 1, 0, 'Bilal' ),
			'e' => array( 'spam', 1, 0, 'Spammer' ),
			'f' => array( 'spam', 0, 1, 'Khan Spam' ),
			'g' => array( 'trash', 0, 0, 'Deleted' ),
		);
		$table        = $wpdb->prefix . 'subtleforms_submissions';
		$time         = strtotime( '2026-01-01 00:00:00 UTC' );
		foreach ( $rows as $label => $row ) {
			$wpdb->insert(
				$table,
				array(
					'form_id'    => $this->formId,
					'payload'    => wp_json_encode( array( 'name' => $row[3] ) ),
					'status'     => $row[0],
					'is_read'    => $row[1],
					'starred'    => $row[2],
					'created_at' => gmdate( 'Y-m-d H:i:s', $time += 60 ),
				)
			);
			$this->ids[ $label ] = (int) $wpdb->insert_id;
		}
	}

	/** The labels of the entries an export with these filters writes. */
	private function exported( array $filters ): array {
		$h       = fopen( 'php://temp', 'r+' );
		$written = $this->api()->streamCsv( $this->formId, $filters, $h );
		rewind( $h );
		fread( $h, 3 );
		$rows = array();
		while ( false !== ( $row = fgetcsv( $h, 0, ',', '"', '' ) ) ) {
			$rows[] = $row;
		}
		fclose( $h );
		$flip = array_flip( $this->ids );
		$out  = array_map( static fn( $row ) => $flip[ (int) $row[0] ] ?? '?', array_slice( $rows, 1 ) );
		$this->assertCount( $written, $out );
		sort( $out );
		return $out;
	}

	/** The labels the list endpoint returns for these query parameters. */
	private function listed( array $params ): array {
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions' );
		$request->set_param( 'form_id', $this->formId );
		$request->set_param( 'per_page', 50 );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		$response = $this->api()->get_all_submissions( $request );
		$data     = $response->get_data();
		$items    = $data['data'] ?? array();
		$flip     = array_flip( $this->ids );
		$out      = array_map( static fn( $item ) => $flip[ (int) $item['id'] ] ?? '?', $items );
		sort( $out );
		return $out;
	}

	public function test_export_on_the_starred_tab_has_exactly_the_starred_entries(): void {
		$this->seed();
		$this->assertSame( array( 'a', 'c' ), $this->exported( array( 'status' => 'starred' ) ) );
	}

	public function test_export_on_the_unread_tab_has_exactly_the_unread_entries(): void {
		$this->seed();
		$this->assertSame( array( 'a', 'b' ), $this->exported( array( 'status' => 'unread' ) ) );
		$this->assertSame( array( 'a', 'b' ), $this->exported( array( 'status' => 'new' ) ), 'the older "new" tab is Unread' );
	}

	public function test_export_on_the_read_tab_has_exactly_the_read_entries(): void {
		$this->seed();
		$this->assertSame( array( 'c', 'd' ), $this->exported( array( 'status' => 'read' ) ) );
	}

	public function test_export_on_the_spam_tab_has_the_spam_entries(): void {
		$this->seed();
		$this->assertSame( array( 'e', 'f' ), $this->exported( array( 'status' => 'spam' ) ) );
	}

	public function test_a_search_on_the_starred_tab_is_the_intersection(): void {
		$this->seed();
		$this->assertSame( array( 'a', 'c' ), $this->exported( array( 'status' => 'starred', 'search' => 'Khan' ) ) );
		$this->assertSame( array( 'a' ), $this->exported( array( 'status' => 'starred', 'search' => 'Ali' ) ) );
		$this->assertSame( array( 'a' ), $this->exported( array( 'status' => 'unread', 'search' => 'Khan' ) ) );
	}

	public function test_all_and_the_trash_tab_leave_the_trash_out(): void {
		$this->seed();
		$live = array( 'a', 'b', 'c', 'd' );
		$this->assertSame( $live, $this->exported( array() ) );
		$this->assertSame( $live, $this->exported( array( 'status' => 'all' ) ) );
		$this->assertSame( $live, $this->exported( array( 'status' => 'trash' ) ), 'entries in the Trash are never exported' );
	}

	public function test_the_processing_status_applies_on_the_all_tab_only(): void {
		$this->seed();
		$this->assertSame( array( 'e', 'f' ), $this->exported( array( 'processing_status' => 'spam' ) ) );
		$this->assertSame( array( 'a', 'b', 'c', 'd' ), $this->exported( array( 'processing_status' => 'completed' ) ) );
		$this->assertSame( array( 'a', 'c' ), $this->exported( array( 'status' => 'starred', 'processing_status' => 'completed' ) ), 'a tab other than All ignores it' );
		// A status that is not a tab is a processing status (how the export was asked before).
		$this->assertSame( array( 'a', 'b', 'c', 'd' ), $this->exported( array( 'status' => 'completed' ) ) );
	}

	public function test_the_list_returns_the_same_rows_for_each_tab(): void {
		$this->seed();
		$this->assertSame( array( 'a', 'b', 'c', 'd' ), $this->listed( array() ) );
		$this->assertSame( array( 'a', 'c' ), $this->listed( array( 'status' => 'starred' ) ) );
		$this->assertSame( array( 'a', 'b' ), $this->listed( array( 'status' => 'unread' ) ) );
		$this->assertSame( array( 'a', 'b' ), $this->listed( array( 'status' => 'new' ) ) );
		$this->assertSame( array( 'c', 'd' ), $this->listed( array( 'status' => 'read' ) ) );
		$this->assertSame( array( 'e', 'f' ), $this->listed( array( 'status' => 'spam' ) ) );
		$this->assertSame( array( 'g' ), $this->listed( array( 'status' => 'trash' ) ) );
		$this->assertSame( array( 'a', 'c' ), $this->listed( array( 'status' => 'starred', 'search' => 'Khan' ) ) );
		$this->assertSame( array( 'a', 'b', 'c', 'd' ), $this->listed( array( 'processing_status' => 'completed' ) ) );
		$this->assertSame( array( 'a', 'c' ), $this->listed( array( 'status' => 'starred', 'processing_status' => 'completed' ) ), 'the processing status is for the All tab only' );
		$this->assertSame( array( 'a', 'b', 'c', 'd' ), $this->listed( array( 'status' => 'nonsense' ) ), 'an unknown tab is All' );
	}

	public function test_the_list_and_the_export_agree_on_every_tab(): void {
		$this->seed();
		foreach ( array( 'starred', 'unread', 'read', 'spam', 'flagged' ) as $tab ) {
			$this->assertSame( $this->listed( array( 'status' => $tab ) ), $this->exported( array( 'status' => $tab ) ), $tab );
		}
	}

	public function test_an_empty_export_goes_back_to_the_screen_with_the_tab_form_search_and_range(): void {
		$this->seed();
		$admin = wp_insert_user( array( 'user_login' => 'adm' . wp_generate_password( 6, false ), 'user_pass' => wp_generate_password(), 'user_email' => 'adm' . wp_generate_password( 6, false ) . '@example.test', 'role' => 'administrator' ) );
		$this->userIds[] = $admin;
		wp_set_current_user( $admin );
		$_GET                    = array(
			'action'    => 'subtleforms_export_csv',
			'_wpnonce'  => wp_create_nonce( SubmissionsApi::EXPORT_NONCE_ACTION ),
			'form_id'   => (string) $this->formId,
			'status'    => 'starred',
			'search'    => 'no such person',
			'range'     => '7days',
		);
		$_SERVER['HTTP_REFERER'] = admin_url( 'admin.php?page=subtleforms-submissions' );
		add_filter(
			'wp_redirect',
			static function ( $location ) {
				throw new \RuntimeException( $location );
			}
		);
		try {
			$this->api()->exportRequest();
			$this->fail( 'an export with no entries is refused' );
		} catch ( \RuntimeException $e ) {
			$url = $e->getMessage();
		}
		$query = array();
		parse_str( (string) wp_parse_url( $url, PHP_URL_QUERY ), $query );
		$this->assertSame( 'subtleforms-submissions', $query['page'] );
		$this->assertSame( 'starred', $query['tab'] );
		$this->assertSame( (string) $this->formId, $query['form_id'] );
		$this->assertSame( 'no such person', $query['search'] );
		$this->assertSame( '7days', $query['range'] );
		$this->assertSame( 'empty', $query['sf_export'] );
	}
}
