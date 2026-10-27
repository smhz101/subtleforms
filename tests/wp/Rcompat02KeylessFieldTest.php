<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * RCOMPAT-02: a field saved without a key is given one on every save path
 * instead of being stored keyless (which stopped the form from loading).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;

final class Rcompat02KeylessFieldTest extends TestCase {

	private function schema(): array {
		return array(
			'metadata'       => array( 'type' => 'multi-step', 'name' => 'Keyless', 'title' => 'Keyless' ),
			'schema_version' => 1,
			'fields'         => array(
				array(
					'id'       => 's1',
					'key'      => 's1',
					'type'     => 'step',
					'children' => array(
						array( 'id' => 'a', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
						array( 'id' => 'f_nokey', 'type' => 'text', 'label' => 'No key' ),
						array( 'type' => 'email', 'label' => 'Email' ),
					),
				),
			),
		);
	}

	public function test_published_save_gives_keyless_inputs_a_key(): void {
		$repo = new FormsRepository();
		$id   = $repo->create( array( 'title' => 'Keyless', 'status' => 'draft' ) );
		$this->formIds[] = (int) $id;
		$repo->saveSchemaVersion( (int) $id, $this->schema(), true );
		$stored = $repo->loadSchemaVersion( (int) $id )['schema'];
		$kids   = $stored['fields'][0]['children'];
		$this->assertSame( 'name', $kids[0]['key'] );
		$this->assertSame( 'f_nokey', $kids[1]['key'] );
		$this->assertMatchesRegularExpression( '/^email_[0-9a-f]{8}$/', $kids[2]['key'] );
	}

	public function test_draft_save_gives_keyless_inputs_a_key(): void {
		$repo = new FormsRepository();
		$id   = $repo->create( array( 'title' => 'Keyless draft', 'status' => 'draft' ) );
		$this->formIds[] = (int) $id;
		$repo->saveDraftSchema( (int) $id, $this->schema() );
		$draft = $repo->getDraftSchema( (int) $id );
		$this->assertSame( 'f_nokey', $draft['fields'][0]['children'][1]['key'] );
		$this->assertNotEmpty( $draft['fields'][0]['children'][2]['key'] );
	}
}
