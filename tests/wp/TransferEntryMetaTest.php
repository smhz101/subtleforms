<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Tools\TransferPackage;
use SubtleForms\Tools\TransferService;

/**
 * RCOMP-01: the export and import carry only the entry meta records an
 * add-on names through subtleforms/transfer/entry_meta_keys. This plugin
 * names none, and never copies the visitor's address or browser.
 */
class TransferEntryMetaTest extends TestCase {

	private function entry( int $form ): int {
		return ( new SubmissionsRepository() )->create(
			array(
				'form_id' => $form,
				'payload' => array( 'name' => 'Ada' ),
				'status'  => 'completed',
				'meta'    => array(
					'request_ip'  => '203.0.113.9',
					'extra_order' => array( 'total' => 20, 'lines' => array( array( 'label' => 'Mug', 'qty' => 2 ) ) ),
					'extra_note'  => array( 'text' => 'kept' ),
				),
			)
		);
	}

	private function service(): TransferService {
		return new TransferService( new FormsRepository(), new SubmissionsRepository() );
	}

	public function test_nothing_but_the_answers_travel_by_default() {
		$form = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->entry( $form );
		$package = $this->service()->exportSubmissions( $form );
		$row     = $package['submissions'][0];
		$this->assertArrayNotHasKey( 'extra_order', $row );
		$this->assertArrayNotHasKey( 'request_ip', $row );
		$this->assertSame( array(), TransferPackage::entryMetaKeys() );
	}

	public function test_an_add_on_can_name_the_records_that_travel() {
		$keys = static fn() => array( 'extra_order', 'import', 'Bad Key', 5 );
		add_filter( 'subtleforms/transfer/entry_meta_keys', $keys );
		$form = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->entry( $form );
		$package = $this->service()->exportSubmissions( $form );
		$row     = $package['submissions'][0];
		$this->assertSame( array( 'extra_order' ), TransferPackage::entryMetaKeys() );
		$this->assertSame( 20, $row['extra_order']['total'] );
		$this->assertArrayNotHasKey( 'extra_note', $row );
		$this->assertArrayNotHasKey( 'request_ip', $row );

		$other  = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$result = $this->service()->importSubmissions( $other, $package );
		remove_filter( 'subtleforms/transfer/entry_meta_keys', $keys );
		$this->assertSame( 1, $result['imported'], wp_json_encode( $result ) );
		$stored = ( new SubmissionsRepository() )->findByForm( $other, array( 'limit' => 5 ) );
		$this->assertSame( 20, $stored[0]['meta']['extra_order']['total'] );
	}
}
