<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Autofill setting (2.10.0) through the real save: an allowed token is kept, an
 * unknown one is dropped, flat or inside a field's config.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class AutocompleteSaveTest extends TestCase {

	public function test_saving_a_form_keeps_an_allowed_autofill_and_drops_an_unknown_one(): void {
		$repo   = new \SubtleForms\Repositories\FormsRepository();
		$schema = array(
			'metadata' => array( 'type' => 'regular' ),
			'fields'   => array(
				array( 'id' => 'a', 'key' => 'a', 'type' => 'text', 'autocomplete' => 'organization' ),
				array( 'id' => 'b', 'key' => 'b', 'type' => 'text', 'autocomplete' => 'nickname' ),
				array( 'id' => 'c', 'key' => 'c', 'type' => 'text', 'config' => array( 'autocomplete' => 'given-name' ) ),
				array( 'id' => 'd', 'key' => 'd', 'type' => 'text', 'config' => array( 'autocomplete' => 'cc-number' ) ),
				array( 'id' => 'e', 'key' => 'e', 'type' => 'text', 'autocomplete' => '' ),
			),
		);
		$id = $repo->create( array( 'title' => 'Autofill save', 'status' => 'draft', 'schema' => $schema ) );
		$this->formIds[] = $id;
		$repo->saveSchemaVersion( $id, $schema, true );
		$saved = $repo->loadSchemaVersion( $id );
		$saved = $saved['schema'] ?? $saved;
		$this->assertSame( 'organization', $saved['fields'][0]['autocomplete'] );
		$this->assertArrayNotHasKey( 'autocomplete', $saved['fields'][1] );
		$this->assertSame( 'given-name', $saved['fields'][2]['config']['autocomplete'] );
		$this->assertArrayNotHasKey( 'autocomplete', $saved['fields'][3]['config'] );
		$this->assertSame( '', $saved['fields'][4]['autocomplete'] );
	}
}
