<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * FF-30: entries reference their schema version instead of a full copy, and
 * the batched migration keeps old entries readable.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\EntrySchema;
use SubtleForms\Tools\EntrySchemaMigration;

final class EntrySchemaRefTest extends TestCase {

	protected function tearDown(): void {
		delete_option( EntrySchemaMigration::OPTION );
		EntrySchema::flush();
		parent::tearDown();
	}

	private function fields(): array {
		return array(
			array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ),
		);
	}

	private function get( string $route ): array {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', $route );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		return (array) rest_do_request( $request )->get_data();
	}

	/** Insert an entry the way versions before 2.4.0 stored it. */
	private function oldEntry( int $formId, ?int $version, string $copyLabel ): int {
		global $wpdb;
		$meta = array(
			'form_schema'    => array( 'fields' => array( array( 'type' => 'text', 'key' => 'city', 'label' => $copyLabel ) ) ),
			'schema_version' => $version,
		);
		$wpdb->insert(
			$wpdb->prefix . 'subtleforms_submissions',
			array(
				'form_id'        => $formId,
				'schema_version' => $version,
				'payload'        => wp_json_encode( array( 'city' => 'Lahore' ) ),
				'meta'           => wp_json_encode( $meta ),
				'status'         => 'completed',
				'created_at'     => current_time( 'mysql', true ),
			)
		);
		return (int) $wpdb->insert_id;
	}

	private function storedMeta( int $entryId ): array {
		global $wpdb;
		return (array) json_decode( (string) $wpdb->get_var( $wpdb->prepare( "SELECT meta FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $entryId ) ), true );
	}

	public function test_new_entries_reference_the_schema_version() {
		$formId = $this->publish( $this->fields() );
		$result = $this->submit( $formId, array( 'city' => 'Lahore' ) );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result ) );

		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT id, schema_version, meta FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ), ARRAY_A );
		$this->assertSame( 1, (int) $row['schema_version'] );
		$this->assertStringNotContainsString( '"form_schema"', (string) $row['meta'] );
		$this->assertStringNotContainsString( '"fields"', (string) $row['meta'] );

		// The entry screen still gets the schema, from its version.
		$entry = $this->get( '/subtleforms/v1/submissions/' . (int) $row['id'] )['data'];
		$this->assertSame( 'City', $entry['schema']['fields'][0]['label'] ?? null );
	}

	public function test_lists_and_entry_responses_never_carry_a_schema_copy() {
		$formId = $this->publish( $this->fields() );
		$this->oldEntry( $formId, 1, 'Old city' );

		$list = $this->get( '/subtleforms/v1/forms/' . $formId . '/submissions' );
		$this->assertStringContainsString( 'Lahore', wp_json_encode( $list ), 'the entry is listed' );
		$this->assertStringNotContainsString( 'form_schema', wp_json_encode( $list ) );
		$all = $this->get( '/subtleforms/v1/submissions' );
		$this->assertStringContainsString( 'Lahore', wp_json_encode( $all ), 'the entry is listed' );
		$this->assertStringNotContainsString( 'form_schema', wp_json_encode( $all ) );
	}

	public function test_migration_drops_copies_in_batches_and_keeps_old_entries_readable() {
		$formId   = $this->publish( $this->fields() );
		$versioned = $this->oldEntry( $formId, 1, 'Copy of city' );
		$noVersion = $this->oldEntry( $formId, null, 'Only copy' );
		$missing   = $this->oldEntry( $formId, 99, 'Copy for a lost version' );

		// Start right before these entries so other rows in the table do not count.
		update_option( EntrySchemaMigration::OPTION, (string) ( $versioned - 1 ) );

		$first = EntrySchemaMigration::runBatch( 2 );
		$this->assertSame( 2, $first['scanned'] );
		$this->assertFalse( $first['done'], 'a full batch leaves the job running' );
		$this->assertSame( (string) $noVersion, get_option( EntrySchemaMigration::OPTION ) );

		$second = EntrySchemaMigration::runBatch( 10 );
		$this->assertTrue( $second['done'] );
		$this->assertSame( 'done', get_option( EntrySchemaMigration::OPTION ) );

		// The entry with a loadable version loses its copy.
		$this->assertArrayNotHasKey( 'form_schema', $this->storedMeta( $versioned ) );
		// Entries with nothing else to read them by keep theirs.
		$this->assertArrayHasKey( 'form_schema', $this->storedMeta( $noVersion ) );
		$this->assertArrayHasKey( 'form_schema', $this->storedMeta( $missing ) );

		// Every entry stays readable.
		EntrySchema::flush();
		$this->assertSame( 'City', $this->get( '/subtleforms/v1/submissions/' . $versioned )['data']['schema']['fields'][0]['label'] ?? null );
		$this->assertSame( 'Only copy', $this->get( '/subtleforms/v1/submissions/' . $noVersion )['data']['schema']['fields'][0]['label'] ?? null );
		$this->assertSame( 'Copy for a lost version', $this->get( '/subtleforms/v1/submissions/' . $missing )['data']['schema']['fields'][0]['label'] ?? null );

		// Running again does nothing.
		$this->assertSame( 0, EntrySchemaMigration::runBatch()['scanned'] );
	}

	public function test_upgrade_schedules_the_job_until_it_is_done() {
		delete_option( EntrySchemaMigration::OPTION );
		wp_clear_scheduled_hook( EntrySchemaMigration::HOOK );
		EntrySchemaMigration::schedule();
		$this->assertNotFalse( wp_next_scheduled( EntrySchemaMigration::HOOK ) );
		$this->assertSame( '0', get_option( EntrySchemaMigration::OPTION ) );

		wp_clear_scheduled_hook( EntrySchemaMigration::HOOK );
		update_option( EntrySchemaMigration::OPTION, 'done' );
		EntrySchemaMigration::schedule();
		$this->assertFalse( wp_next_scheduled( EntrySchemaMigration::HOOK ) );
	}
}
