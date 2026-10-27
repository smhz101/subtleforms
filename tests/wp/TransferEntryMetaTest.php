<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Tools\TransferPackage;
use SubtleForms\Tools\TransferService;

/**
 * RCOMP-01: an exported entry keeps every record another plugin saved on it,
 * whether or not that plugin is active, and never copies what this plugin
 * writes itself (the visitor's address and browser, request state, notes).
 */
class TransferEntryMetaTest extends TestCase {

	private const BASE = array( 'entry_id', 'status', 'is_read', 'starred', 'created_at', 'payload' );

	private function entry( int $form, array $extra = array() ): int {
		return ( new SubmissionsRepository() )->create(
			array(
				'form_id' => $form,
				'payload' => array( 'name' => 'Ada' ),
				'status'  => 'completed',
				'meta'    => array_merge(
					array(
						'request_ip'         => '203.0.113.9',
						'request_user_agent' => 'Agent',
						'notes'              => array( array( 'id' => 'n1', 'text' => 'private' ) ),
						'consents'           => array( 'terms' => '2026-01-01' ),
						'import'             => array( 'ref' => 'abc' ),
						'extra_order'        => array( 'total' => 20, 'lines' => array( array( 'label' => 'Mug', 'qty' => 2 ) ), 'api_token' => 'hide-me' ),
						'extra_note'         => array( 'text' => 'kept' ),
						'plain_value'        => 'a string is not a record',
					),
					$extra
				),
			)
		);
	}

	private function service(): TransferService {
		return new TransferService( new FormsRepository(), new SubmissionsRepository() );
	}

	private function form(): int {
		return $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
	}

	public function test_records_another_plugin_saved_travel_and_this_plugins_own_meta_does_not() {
		$form = $this->form();
		$this->entry( $form, array( 'huge' => array( 'blob' => str_repeat( 'x', 70000 ) ) ) );
		$row = $this->service()->exportSubmissions( $form )['submissions'][0];

		$this->assertSame( 20, $row['extra_order']['total'] );
		$this->assertSame( 'Mug', $row['extra_order']['lines'][0]['label'] );
		$this->assertSame( 'kept', $row['extra_note']['text'] );
		$this->assertArrayNotHasKey( 'api_token', $row['extra_order'], 'secrets are left out' );
		foreach ( array( 'request_ip', 'request_user_agent', 'notes', 'consents', 'import', 'plain_value', 'huge' ) as $key ) {
			$this->assertArrayNotHasKey( $key, $row, $key );
		}
	}

	/** Catches a new meta record this plugin starts to write and forgets to list as its own. */
	public function test_a_real_submission_exports_only_the_answers_and_the_state() {
		$form = $this->form();
		$this->assertSame( 200, $this->submit( $form, array( 'name' => 'Ada' ) )['status'] );
		$row = $this->service()->exportSubmissions( $form )['submissions'][0];
		$this->assertSame( array(), array_values( array_diff( array_keys( $row ), self::BASE ) ), wp_json_encode( array_keys( $row ) ) );
	}

	public function test_an_add_on_can_narrow_the_records_and_they_come_back_on_import() {
		$keep = static fn( $keys ) => array_values( array_intersect( $keys, array( 'extra_order' ) ) );
		add_filter( 'subtleforms/transfer/entry_meta_keys', $keep );
		$form = $this->form();
		$this->entry( $form );
		$package = $this->service()->exportSubmissions( $form );
		$row     = $package['submissions'][0];
		$this->assertArrayHasKey( 'extra_order', $row );
		$this->assertArrayNotHasKey( 'extra_note', $row );

		$other  = $this->form();
		$result = $this->service()->importSubmissions( $other, $package );
		remove_filter( 'subtleforms/transfer/entry_meta_keys', $keep );
		$this->assertSame( 1, $result['imported'], wp_json_encode( $result ) );
		$stored = ( new SubmissionsRepository() )->findByForm( $other, array( 'limit' => 5 ) );
		$this->assertSame( 20, $stored[0]['meta']['extra_order']['total'] );
		$this->assertArrayNotHasKey( 'extra_note', $stored[0]['meta'] );
	}

	public function test_an_import_takes_only_records_never_this_plugins_own_meta() {
		$form    = $this->form();
		$package = TransferPackage::submissions(
			array( 'id' => 1, 'title' => 'T' ),
			array(
				array(
					'entry_id' => 5,
					'status'   => 'completed',
					'created_at' => '2026-01-01 00:00:00',
					'payload'  => array( 'name' => 'Grace' ),
					'order'    => array( 'total' => 9 ),
					'request_ip' => array( 'x' => 1 ),
					'notes'    => array( array( 'text' => 'forged' ) ),
				),
			)
		);
		$result = $this->service()->importSubmissions( $form, $package );
		$this->assertSame( 1, $result['imported'], wp_json_encode( $result ) );
		$meta = ( new SubmissionsRepository() )->findByForm( $form, array( 'limit' => 5 ) )[0]['meta'];
		$this->assertSame( 9, $meta['order']['total'] );
		$this->assertArrayNotHasKey( 'notes', $meta );
		$this->assertArrayNotHasKey( 'request_ip', $meta );
	}
}
