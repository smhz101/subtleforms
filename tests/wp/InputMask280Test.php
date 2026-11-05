<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Input mask (2.8.0) end to end on the server: a form with masked fields is
 * saved, the unknown values are cleaned, answers are checked by the public
 * submit endpoint and stored the way the field says.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class InputMask280Test extends TestCase {

	private function fields(): array {
		return array(
			array( 'id' => 'a', 'key' => 'birthday', 'type' => 'text', 'label' => 'Birthday', 'inputMask' => 'date_dmy' ),
			array( 'id' => 'b', 'key' => 'code', 'type' => 'text', 'label' => 'Code', 'inputMask' => 'custom', 'maskPattern' => 'AA-9999' ),
			array( 'id' => 'c', 'key' => 'zip', 'type' => 'text', 'label' => 'ZIP', 'inputMask' => 'zip_us', 'maskStore' => 'digits' ),
			array( 'id' => 'd', 'key' => 'mobile', 'type' => 'phone', 'label' => 'Mobile', 'inputMask' => 'phone' ),
			array( 'id' => 'e', 'key' => 'slot', 'type' => 'text', 'label' => 'Time', 'inputMask' => 'time_24' ),
		);
	}

	private function good(): array {
		return array(
			'birthday' => '31/12/2026',
			'code'     => 'ab-1234',
			'zip'      => '12345-6789',
			'mobile'   => '(555) 010-1234',
			'slot'     => '09:30',
		);
	}

	public function test_a_complete_valid_form_is_stored_as_the_fields_say(): void {
		$form   = $this->publish( $this->fields() );
		$result = $this->submit( $form, $this->good() );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$stored = $this->storedPayload( $form );
		$this->assertSame( '31/12/2026', $stored['birthday'] );
		$this->assertSame( 'ab-1234', $stored['code'] );
		$this->assertSame( '123456789', $stored['zip'], 'digits only' );
		$this->assertSame( '(555) 010-1234', $stored['mobile'] );
		$this->assertSame( '09:30', $stored['slot'] );
	}

	public function test_each_bad_answer_gets_a_message_naming_the_format(): void {
		$form = $this->publish( $this->fields() );
		$cases = array(
			'birthday' => array( '31/02/2026', 'That date does not exist. Enter the date as DD/MM/YYYY.' ),
			'code'     => array( 'a1-1234', 'Enter this in the format AA-9999.' ),
			'zip'      => array( '1234', 'Enter a US ZIP code, such as 12345 or 12345-6789.' ),
			'mobile'   => array( 'call me', 'Invalid phone number.' ),
			'slot'     => array( '25:00', 'Enter the time as HH:MM (24-hour).' ),
		);
		foreach ( $cases as $key => list( $bad, $message ) ) {
			$result = $this->submit( $form, array_merge( $this->good(), array( $key => $bad ) ) );
			$this->assertSame( 422, $result['status'], $key );
			$errors = (array) ( $result['data']['error']['meta']['fields'] ?? array() );
			$this->assertSame( $message, $errors[ $key ] ?? null, $key . ' ' . wp_json_encode( $result['data'] ) );
		}
	}

	public function test_empty_optional_masked_fields_pass(): void {
		$form   = $this->publish( $this->fields() );
		$result = $this->submit( $form, array( 'birthday' => '', 'code' => '', 'zip' => '', 'mobile' => '', 'slot' => '' ) );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
	}

	public function test_saving_a_form_drops_an_unknown_mask_and_keeps_known_ones(): void {
		$repo   = new \SubtleForms\Repositories\FormsRepository();
		$schema = array(
			'metadata' => array( 'type' => 'regular' ),
			'fields'   => array(
				array( 'id' => 'a', 'key' => 'a', 'type' => 'text', 'inputMask' => 'credit_card', 'maskStore' => 'x' ),
				array( 'id' => 'b', 'key' => 'b', 'type' => 'text', 'config' => array( 'inputMask' => 'zip_us', 'maskPattern' => str_repeat( '9', 100 ) ) ),
			),
		);
		$id = $repo->create( array( 'title' => 'Mask save', 'status' => 'draft', 'schema' => $schema ) );
		$this->formIds[] = $id;
		$repo->saveSchemaVersion( $id, $schema, true );
		$saved = $repo->loadSchemaVersion( $id );
		$saved = $saved['schema'] ?? $saved;
		$this->assertSame( '', $saved['fields'][0]['inputMask'] );
		$this->assertSame( 'typed', $saved['fields'][0]['maskStore'] );
		$this->assertSame( 'zip_us', $saved['fields'][1]['config']['inputMask'] );
		$this->assertSame( 64, strlen( $saved['fields'][1]['config']['maskPattern'] ) );
	}

	public function test_the_form_container_lists_the_mask_feature_only_when_needed(): void {
		$with = \SubtleForms\Frontend\FrontendAssets::fieldGroups( array( 'fields' => $this->fields() ) );
		$this->assertContains( 'mask', $with );
		$without = \SubtleForms\Frontend\FrontendAssets::fieldGroups( array( 'fields' => array( array( 'type' => 'text', 'key' => 'a' ) ) ) );
		$this->assertNotContains( 'mask', $without );
	}
}
