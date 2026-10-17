<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * SchemaMigrator unit tests — migrating a schema must never drop fields.
 *
 * Guards the Part A4 regression: a consent field disappeared from a published
 * form after a 1.9.x normaliser. No migration may remove fields the author
 * added — it may only transform shape.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SchemaMigrator;

class SchemaMigratorTest extends TestCase {

	private function newsletter_schema() {
		return array(
			'schema_version' => 1,
			'metadata'       => array(
				'name'  => 'Newsletter sign up',
				'title' => 'Newsletter sign up',
			),
			'fields'          => array(
				array( 'id' => 'n1', 'key' => 'name_group_1', 'type' => 'name_group', 'kind' => 'group', 'config' => array( 'required' => true ) ),
				array( 'id' => 'n2', 'key' => 'email_1', 'type' => 'email', 'kind' => 'input', 'config' => array( 'required' => true ) ),
				array( 'id' => 'n3', 'key' => 'consent_1', 'type' => 'consent', 'kind' => 'input', 'config' => array( 'required' => true, 'checkboxLabel' => 'I agree' ) ),
				array( 'id' => 'n4', 'key' => 'phone_1', 'type' => 'phone', 'kind' => 'input', 'config' => array() ),
			),
		);
	}

	public function test_migrate_preserves_every_field() {
		$schema    = $this->newsletter_schema();
		$migrated = ( new SchemaMigrator() )->migrate( $schema );

		$keys = array_column( $migrated['fields'], 'key' );
		$this->assertSame(
			array( 'name_group_1', 'email_1', 'consent_1', 'phone_1' ),
			$keys
		);
	}

	public function test_migrate_preserves_the_consent_field() {
		$migrated = ( new SchemaMigrator() )->migrate( $this->newsletter_schema() );

		$consent = null;
		foreach ( $migrated['fields'] as $field ) {
			if ( 'consent_1' === $field['key'] ) {
				$consent = $field;
				break;
			}
		}

		$this->assertNotNull( $consent, 'Consent field was dropped by the migrator' );
		$this->assertSame( 'consent', $consent['type'] );
		$this->assertSame( 'I agree', $consent['config']['checkboxLabel'] );
	}

	public function test_migrate_does_not_reduce_field_count() {
		$schema    = $this->newsletter_schema();
		$migrated = ( new SchemaMigrator() )->migrate( $schema );

		$this->assertSame( count( $schema['fields'] ), count( $migrated['fields'] ) );
	}

	public function test_migrate_is_idempotent() {
		$migrator = new SchemaMigrator();
		$once     = $migrator->migrate( $this->newsletter_schema() );
		$twice    = $migrator->migrate( $once );

		$this->assertSame( count( $once['fields'] ), count( $twice['fields'] ) );
		$this->assertSame( array_column( $once['fields'], 'key' ), array_column( $twice['fields'], 'key' ) );
	}
}
