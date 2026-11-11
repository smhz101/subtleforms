<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Free 101: parts added to the Address field are stored and never shown, and
 * entries saved with the older answer keys read as before.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Fields\CompositeParts;
use SubtleForms\Repositories\SubmissionsRepository;

final class AddressPartsFilter101Test extends TestCase {

	protected function tearDown(): void {
		remove_all_filters( 'subtleforms/fields/composite_parts' );
		CompositeParts::resetCache();
		parent::tearDown();
	}

	private function addLatLng(): void {
		add_filter(
			'subtleforms/fields/composite_parts',
			static function ( $parts, $type ) {
				if ( 'address_group' === $type ) {
					$parts[] = array( 'part' => 'lat', 'value' => 'lat', 'data' => true );
					$parts[] = array( 'part' => 'lng', 'value' => 'lng', 'data' => true );
				}
				return $parts;
			},
			10,
			2
		);
		CompositeParts::resetCache();
	}

	private function fields(): array {
		return array( array( 'type' => 'address_group', 'key' => 'addr', 'label' => 'Address' ) );
	}

	private function entryText( int $entryId ): string {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions/' . $entryId );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		return (string) rest_do_request( $request )->get_data()['data']['display']['addr']['text'];
	}

	public function test_an_entry_saved_with_alias_keys_still_displays_the_same(): void {
		$formId  = $this->publish( $this->fields() );
		$entryId = ( new SubmissionsRepository() )->create(
			array(
				'form_id'        => $formId,
				'schema_version' => 1,
				'payload'        => array( 'addr' => array( 'street' => '1 Main', 'street2' => 'Flat 2', 'city' => 'Lahore', 'postal' => '54000', 'country' => 'Pakistan' ) ),
				'status'         => 'completed',
			)
		);
		$this->assertSame( '1 Main, Flat 2, Lahore, 54000, Pakistan', $this->entryText( $entryId ) );
		$this->addLatLng();
		$this->assertSame( '1 Main, Flat 2, Lahore, 54000, Pakistan', $this->entryText( $entryId ) );
	}

	public function test_a_new_submission_with_a_filtered_part_stores_it_and_the_entry_text_omits_it(): void {
		$this->addLatLng();
		$formId = $this->publish( $this->fields() );
		$result = $this->submit(
			$formId,
			array( 'addr' => array( 'street_address' => '1 Main', 'city' => 'Lahore', 'country' => 'Pakistan', 'lat' => '31.52', 'lng' => '74.35', 'evil' => 'x' ) )
		);
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$stored = $this->storedPayload( $formId )['addr'];
		$this->assertSame( '31.52', $stored['lat'] );
		$this->assertSame( '74.35', $stored['lng'] );
		$this->assertArrayNotHasKey( 'evil', $stored );

		global $wpdb;
		$entryId = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ) );
		$text    = $this->entryText( $entryId );
		$this->assertSame( '1 Main, Lahore, Pakistan', $text );
		$this->assertStringNotContainsString( '31.52', $text );
	}
}
