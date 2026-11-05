<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Importing WPForms and Ninja Forms forms and, when the owner agrees, their
 * entries, end to end on a real site. The other plugins are not installed:
 * their data is put where they keep it.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

require_once dirname( __DIR__ ) . '/fixtures/import/Seeder.php';

use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Tests\Fixtures\ImportSeeder;

final class ImportEntriesTest extends TestCase {

	/** @var array */
	private $seeded;

	protected function setUp(): void {
		parent::setUp();
		ImportSeeder::clean();
		$this->seeded = ImportSeeder::seed();
		$this->asAdmin();
	}

	protected function tearDown(): void {
		ImportSeeder::clean();
		parent::tearDown();
	}

	private function rest( string $method, string $route, array $body = array() ): \WP_REST_Response {
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $route );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		if ( $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		return rest_do_request( $request );
	}

	/**
	 * @return int New form id.
	 */
	private function importForm( string $source, int $sourceId ): int {
		$response = $this->rest( 'POST', "/tools/migrate/sources/{$source}/import", array( 'ids' => array( (string) $sourceId ) ) );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$result = $response->get_data()['data'][0];
		$this->assertSame( 'imported', $result['status'] );
		$this->formIds[] = (int) $result['form_id'];
		return (int) $result['form_id'];
	}

	/**
	 * Run the entry batches the screen would, until done.
	 */
	private function copyEntries( string $source, int $sourceId, int $formId ): array {
		$after  = 0;
		$totals = array( 'imported' => 0, 'skipped' => 0, 'failed' => 0, 'files' => 0, 'requests' => 0 );
		do {
			$response = $this->rest( 'POST', "/tools/migrate/sources/{$source}/entries", array( 'id' => (string) $sourceId, 'form_id' => $formId, 'after' => $after, 'consent' => true ) );
			$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
			$data = $response->get_data()['data'];
			foreach ( array( 'imported', 'skipped', 'failed', 'files' ) as $key ) {
				$totals[ $key ] += $data[ $key ];
			}
			++$totals['requests'];
			$after = $data['next'];
		} while ( ! $data['done'] && $totals['requests'] < 50 );
		return $totals;
	}

	private function entries( int $formId ): array {
		return ( new SubmissionsRepository() )->findByForm( $formId, array( 'limit' => 1000 ) );
	}

	public function test_forms_list_shows_entry_counts_without_spam_or_trash(): void {
		$wp = $this->rest( 'GET', '/tools/migrate/sources/wpforms/forms' )->get_data()['data'];
		$this->assertSame( 4, $wp[0]['entries'], 'The spam entry is not counted.' );
		$nf = $this->rest( 'GET', '/tools/migrate/sources/ninja/forms' )->get_data()['data'];
		$this->assertSame( 3, $nf[0]['entries'], 'The trashed entry is not counted.' );
		$cf7 = $this->rest( 'GET', '/tools/migrate/sources/cf7/forms' )->get_data()['data'];
		$this->assertSame( 0, $cf7[0]['entries'] );
	}

	public function test_a_form_import_alone_copies_no_entries(): void {
		$formId = $this->importForm( 'wpforms', $this->seeded['wpforms'][0] );
		$this->assertSame( array(), $this->entries( $formId ) );
		$form = ( new \SubtleForms\Repositories\FormsRepository() )->find( $formId );
		$this->assertSame( 'draft', $form['status'] );
	}

	public function test_entries_need_the_consent_flag(): void {
		$formId   = $this->importForm( 'wpforms', $this->seeded['wpforms'][0] );
		$response = $this->rest( 'POST', '/tools/migrate/sources/wpforms/entries', array( 'id' => (string) $this->seeded['wpforms'][0], 'form_id' => $formId ) );
		$this->assertSame( 422, $response->get_status() );
		$this->assertSame( array(), $this->entries( $formId ) );
	}

	public function test_entries_only_go_into_a_form_made_from_that_form(): void {
		$formId = $this->importForm( 'wpforms', $this->seeded['wpforms'][0] );
		$other  = $this->importForm( 'ninja', $this->seeded['ninja'][0] );
		$bad    = $this->rest( 'POST', '/tools/migrate/sources/wpforms/entries', array( 'id' => (string) $this->seeded['wpforms'][0], 'form_id' => $other, 'consent' => true ) );
		$this->assertSame( 422, $bad->get_status() );
		$this->assertNotSame( 0, $formId );
	}

	public function test_wpforms_entries_keep_date_ip_values_and_the_source(): void {
		$source = $this->seeded['wpforms'][0];
		$formId = $this->importForm( 'wpforms', $source );
		$totals = $this->copyEntries( 'wpforms', $source, $formId );
		$this->assertSame( 4, $totals['imported'] );
		$this->assertSame( 4, $totals['files'] );
		$rows = $this->entries( $formId );
		$this->assertCount( 4, $rows );
		usort( $rows, static function ( $a, $b ) {
			return strcmp( $a['created_at'], $b['created_at'] );
		} );
		$first = $rows[0];
		$this->assertSame( '2025-03-10 10:01:00', $first['created_at'] );
		$this->assertSame( '203.0.113.1', $first['ip_address'] );
		$this->assertSame( 'Browser/1.1', $first['user_agent'] );
		$this->assertSame( 1, (int) $first['is_read'] );
		$this->assertSame( array( 'first_name' => 'Ada1', 'last_name' => 'Lovelace' ), $first['payload']['your_name'] );
		$this->assertSame( 'ada1@example.com', $first['payload']['email'] );
		$this->assertSame( array( 'Widgets', 'Gizmos' ), $first['payload']['products'] );
		$this->assertSame( '2025-03-11', $first['payload']['preferred_day'] );
		$this->assertStringContainsString( 'https://example.com/wp-content/uploads/wpforms/a1.pdf', $first['payload']['attachment'] );
		$this->assertArrayNotHasKey( 'sign_here', $first['payload'], 'Skipped fields are not copied.' );
		$meta = $first['meta']['import'];
		$this->assertSame( 'wpforms', $meta['imported_from'] );
		$this->assertSame( (string) $source, $meta['original_form_id'] );
		$this->assertSame( 'wpforms:' . $source . ':' . $meta['original_id'], $meta['ref'] );
	}

	public function test_a_second_run_skips_what_is_already_there(): void {
		$source = $this->seeded['wpforms'][0];
		$formId = $this->importForm( 'wpforms', $source );
		$this->copyEntries( 'wpforms', $source, $formId );
		$again = $this->copyEntries( 'wpforms', $source, $formId );
		$this->assertSame( 0, $again['imported'] );
		$this->assertSame( 4, $again['skipped'] );
		$this->assertCount( 4, $this->entries( $formId ) );
	}

	public function test_ninja_entries_keep_date_values_and_have_no_ip(): void {
		$source = $this->seeded['ninja'][0];
		$formId = $this->importForm( 'ninja', $source );
		$totals = $this->copyEntries( 'ninja', $source, $formId );
		$this->assertSame( 3, $totals['imported'] );
		$rows = $this->entries( $formId );
		usort( $rows, static function ( $a, $b ) {
			return strcmp( $a['created_at'], $b['created_at'] );
		} );
		$first = $rows[0];
		$this->assertSame( '2025-04-01 08:01:00', $first['created_at'] );
		$this->assertSame( '', (string) $first['ip_address'] );
		$this->assertSame( 'Grace1', $first['payload']['firstname'] );
		$this->assertSame( 'grace1@example.com', $first['payload']['email'] );
		$this->assertSame( array( 'Gift wrap', 'Express' ), $first['payload']['extras'] );
		$this->assertTrue( $first['payload']['subscribe'] );
		$this->assertSame( '2025-04-01', $first['payload']['visit'] );
		$this->assertSame( 'ninja', $first['meta']['import']['imported_from'] );
		$this->assertSame( 0, $this->copyEntries( 'ninja', $source, $formId )['imported'] );
	}

	public function test_thousands_of_entries_copy_in_batches(): void {
		$source = $this->seeded['wpforms'][0];
		$formId = $this->importForm( 'wpforms', $source );
		global $wpdb;
		$table = $wpdb->prefix . 'wpforms_entries';
		$wpdb->query( 'BEGIN' );
		for ( $i = 0; $i < 450; $i++ ) {
			ImportSeeder::wpformsEntry( $source, array( 'date' => '2024-01-01 00:00:00', 'fields' => array( '2' => array( 'value' => "bulk{$i}@example.com" ) ) ) );
		}
		$wpdb->query( 'COMMIT' );
		$totals = $this->copyEntries( 'wpforms', $source, $formId );
		$this->assertSame( 454, $totals['imported'] );
		$this->assertGreaterThanOrEqual( 3, $totals['requests'] );
		$this->assertCount( 454, $this->entries( $formId ) );
		$this->assertSame( 454, (int) $this->rest( 'GET', '/tools/migrate/sources/wpforms/forms' )->get_data()['data'][0]['entries'] );
	}

	public function test_the_originals_are_not_changed(): void {
		global $wpdb;
		$before = md5( wp_json_encode( $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}wpforms_entries", ARRAY_A ) ) . wp_json_encode( $wpdb->get_results( "SELECT meta_key, meta_value FROM {$wpdb->postmeta} WHERE meta_key LIKE '\\_field\\_%'", ARRAY_A ) ) );
		foreach ( array( 'wpforms', 'ninja' ) as $source ) {
			$sourceId = $this->seeded[ $source ][0];
			$this->copyEntries( $source, $sourceId, $this->importForm( $source, $sourceId ) );
		}
		$after = md5( wp_json_encode( $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}wpforms_entries", ARRAY_A ) ) . wp_json_encode( $wpdb->get_results( "SELECT meta_key, meta_value FROM {$wpdb->postmeta} WHERE meta_key LIKE '\\_field\\_%'", ARRAY_A ) ) );
		$this->assertSame( $before, $after );
	}

	public function test_the_form_reports_what_could_not_be_brought_across(): void {
		$response = $this->rest( 'POST', '/tools/migrate/sources/wpforms/import', array( 'ids' => array( (string) $this->seeded['wpforms'][0] ) ) );
		$result   = $response->get_data()['data'][0];
		$this->formIds[] = (int) $result['form_id'];
		$text = implode( "\n", array_column( $result['notes'], 'text' ) );
		$this->assertStringContainsString( "type captcha) was skipped", $text );
		$this->assertStringContainsString( 'several groups joined by OR', $text );
		$this->assertSame( 4, $result['entries'] );
		$this->assertStringContainsString( 'subtleforms-new-form&form_id=' . $result['form_id'], $result['edit_url'] );
	}

	public function test_export_files_import_through_migrate(): void {
		$wp   = json_decode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/import/wpforms-export.json' ), true );
		$res  = $this->rest( 'POST', '/tools/migrate/preview', array( 'package' => $wp ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$this->assertSame( 'wpforms', $res->get_data()['data']['source'] );

		$raw = base64_encode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/import/ninja-export.nff' ) );
		$res = $this->rest( 'POST', '/tools/migrate/preview', array( 'raw' => $raw ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$this->assertSame( 'ninja', $res->get_data()['data']['source'] );

		$res = $this->rest( 'POST', '/tools/migrate/preview', array( 'raw' => 'garbage' ) );
		$this->assertSame( 422, $res->get_status() );
		$this->assertStringContainsString( 'not a Ninja Forms export', wp_json_encode( $res->get_data() ) );

		$res = $this->rest( 'POST', '/tools/migrate/import', array( 'raw' => $raw, 'source' => 'ninja' ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		foreach ( $res->get_data()['data']['created'] as $made ) {
			$this->formIds[] = (int) $made['id'];
		}
		$this->assertCount( 1, $res->get_data()['data']['created'] );
	}
}
