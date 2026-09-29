<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * FormMeta unit tests — single source of truth for type/status.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\FormMeta;

class FormMetaTest extends TestCase {

	public function test_normalize_type_maps_legacy_aliases() {
		$this->assertSame( FormMeta::TYPE_MULTI_STEP, FormMeta::normalize_type( 'multistep' ) );
		$this->assertSame( FormMeta::TYPE_MULTI_STEP, FormMeta::normalize_type( 'sectioned' ) );
		$this->assertSame( FormMeta::TYPE_MULTI_STEP, FormMeta::normalize_type( 'multi-step' ) );
		$this->assertSame( FormMeta::TYPE_CONVERSATIONAL, FormMeta::normalize_type( 'conversational' ) );
		$this->assertSame( FormMeta::TYPE_STANDARD, FormMeta::normalize_type( 'regular' ) );
		$this->assertSame( FormMeta::TYPE_STANDARD, FormMeta::normalize_type( 'payment' ) );
		$this->assertSame( FormMeta::TYPE_STANDARD, FormMeta::normalize_type( null ) );
		$this->assertSame( FormMeta::TYPE_STANDARD, FormMeta::normalize_type( '' ) );
		$this->assertSame( FormMeta::TYPE_STANDARD, FormMeta::normalize_type( 'unknown' ) );
	}

	public function test_normalize_status_maps_known_values() {
		$this->assertSame( FormMeta::STATUS_PUBLISHED, FormMeta::normalize_status( 'published' ) );
		$this->assertSame( FormMeta::STATUS_ARCHIVED, FormMeta::normalize_status( 'archived' ) );
		$this->assertSame( FormMeta::STATUS_DRAFT, FormMeta::normalize_status( 'draft' ) );
		$this->assertSame( FormMeta::STATUS_DRAFT, FormMeta::normalize_status( null ) );
		$this->assertSame( FormMeta::STATUS_DRAFT, FormMeta::normalize_status( 'something-else' ) );
	}

	public function test_type_prefers_form_type_then_metadata_then_config() {
		$this->assertSame( FormMeta::TYPE_CONVERSATIONAL, FormMeta::type( array( 'form_type' => 'conversational' ) ) );
		$this->assertSame( FormMeta::TYPE_MULTI_STEP, FormMeta::type( array( 'metadata' => array( 'type' => 'multistep' ) ) ) );
		$this->assertSame( FormMeta::TYPE_STANDARD, FormMeta::type( array( 'config' => array( 'metadata' => array( 'type' => 'regular' ) ) ) ) );
		// form_type wins over metadata.
		$this->assertSame(
			FormMeta::TYPE_CONVERSATIONAL,
			FormMeta::type( array( 'form_type' => 'conversational', 'metadata' => array( 'type' => 'regular' ) ) )
		);
	}

	public function test_has_unpublished_changes_only_for_published_forms_with_diverging_draft() {
		$config = array( 'fields' => array( array( 'key' => 'a' ) ) );
		$draft  = array( 'fields' => array( array( 'key' => 'a' ), array( 'key' => 'b' ) ) );

		$config_json = wp_json_encode( $config );
		$draft_json  = wp_json_encode( $draft );

		// Published with diverging draft → true.
		$this->assertTrue( FormMeta::has_unpublished_changes( array(
			'status'       => 'published',
			'config'       => $config_json,
			'draft_schema' => $draft_json,
		) ) );

		// Published with matching draft → false.
		$this->assertFalse( FormMeta::has_unpublished_changes( array(
			'status'       => 'published',
			'config'       => $config_json,
			'draft_schema' => $config_json,
		) ) );

		// Draft form → false regardless of draft/config.
		$this->assertFalse( FormMeta::has_unpublished_changes( array(
			'status'       => 'draft',
			'config'       => $config_json,
			'draft_schema' => $draft_json,
		) ) );

		// Pre-computed flag from list SQL is trusted.
		$this->assertTrue( FormMeta::has_unpublished_changes( array(
			'status'                    => 'published',
			'has_unpublished_changes'   => 1,
		) ) );
		$this->assertFalse( FormMeta::has_unpublished_changes( array(
			'status'                    => 'published',
			'has_unpublished_changes'   => 0,
		) ) );
	}

	public function test_with_meta_attaches_canonical_fields() {
		$form = FormMeta::with_meta( array(
			'form_type' => 'conversational',
			'status'    => 'published',
			'config'    => wp_json_encode( array( 'fields' => array() ) ),
			'draft_schema' => wp_json_encode( array( 'fields' => array( array( 'key' => 'x' ) ) ) ),
		) );

		$this->assertSame( FormMeta::TYPE_CONVERSATIONAL, $form['type'] );
		$this->assertSame( FormMeta::STATUS_PUBLISHED, $form['status'] );
		$this->assertTrue( $form['has_unpublished_changes'] );
	}
}
