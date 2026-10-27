<?php
/**
 * Free and Pro split (2.3.9, package F239-1).
 *
 * WordPress.org guideline 5: the free plugin ships no code that a license
 * switches on. These tests fail if a capability gate, a locked field or a
 * Pro-only engine comes back into the free plugin.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\FieldTypeAvailability;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldsV2;
use SubtleForms\Support\Capabilities;
use SubtleForms\Uploads\Uploads;

final class FreeProSplitTest extends TestCase {

	private static function registry(): FieldRegistry {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		FieldsV2::register( $registry );
		return $registry;
	}

	private static function root(): string {
		return dirname( __DIR__, 2 );
	}

	/** WP2-01, WP2-02, WP2-03, WP2-05, WP2-07: no free default is off. */
	public function test_every_free_capability_default_is_on(): void {
		foreach ( Capabilities::defaults() as $key => $on ) {
			$this->assertTrue( $on, "{$key} is on by default" );
		}
		$caps = new Capabilities();
		$this->assertTrue( $caps->allows( 'submissions.export' ) );
		// Advanced conditional logic is part of SubtleForms Pro (2.7.0).
		$this->assertFalse( $caps->allows( 'logic.conditional.advanced' ) );
		$this->assertFalse( $caps->allows( 'extensions.analytics' ) );
	}

	/** WP2-04, WP2-05, PRO-10: no free field type needs a capability. */
	public function test_no_free_field_type_requires_a_capability(): void {
		foreach ( self::registry()->toArray() as $field ) {
			$type = (string) ( $field['type'] ?? '' );
			$this->assertEmpty( $field['requiredCapabilities'] ?? array(), "{$type} needs no capability" );
		}
	}

	/** WP2-04: Signature, Calculation and Card Payment are registered by Pro. */
	public function test_pro_field_types_are_not_in_free(): void {
		$registry = self::registry();
		foreach ( array( 'signature', 'calculation', 'payment_card' ) as $type ) {
			$this->assertFalse( $registry->has( $type ), "{$type} is not registered by the free plugin" );
		}
		// Picture Choice moved to SubtleForms Pro in 2.7.0.
		$this->assertFalse( $registry->has( 'picture_choice' ) );
		// Product and Priced options moved to SubtleForms Pro in 2.8.0.
		$this->assertFalse( $registry->has( 'payment_product' ) );
		$this->assertFalse( $registry->has( 'payment_choice' ) );
		// Custom Amount, Order Summary, Coupon Code and Fixed Fee moved in 2.8.0 as well.
		foreach ( array( 'payment_amount', 'payment_summary', 'payment_coupon', 'payment_hidden_price' ) as $type ) {
			$this->assertFalse( $registry->has( $type ), "{$type} is not registered by the free plugin" );
		}
		$this->assertFalse( class_exists( 'SubtleForms\\Payments\\Pricing' ) );
		$this->assertFalse( class_exists( 'SubtleForms\\Engine\\Formula' ) );
		$this->assertFileDoesNotExist( self::root() . '/resources/frontend/components/fields/SignaturePad.jsx' );
		$this->assertFileDoesNotExist( self::root() . '/resources/frontend/utils/formula.js' );
	}

	/** Several files per field moved to SubtleForms Pro in 2.7.0: a saved multi-file field takes one file. */
	public function test_multi_file_uploads_take_one_file_without_an_add_on(): void {
		$field = array( 'type' => 'file_upload', 'multiple' => true, 'maxFiles' => 4 );
		$this->assertSame( 1, Uploads::maxFiles( $field ) );
		$this->assertSame( 1, Uploads::maxFiles( array( 'type' => 'file_upload' ) ) );
		$this->assertFalse( method_exists( Uploads::class, 'limitPublicSchema' ) );
	}

	/** Fields from a missing add-on are left out of the live form, at any depth. */
	public function test_missing_addon_fields_are_left_out_of_the_live_form(): void {
		$nodes = array(
			array( 'type' => 'text', 'key' => 'name' ),
			array( 'type' => 'signature', 'key' => 'sig' ),
			array(
				'type'     => 'step',
				'children' => array(
					array( 'type' => 'calculation', 'key' => 'total' ),
					array( 'type' => 'email', 'key' => 'email' ),
				),
			),
		);
		$out = FieldTypeAvailability::strip( $nodes, array( 'signature', 'calculation' ) );
		$this->assertCount( 2, $out );
		$this->assertSame( 'text', $out[0]['type'] );
		$this->assertSame( array( 'email' ), array_column( $out[1]['children'], 'type' ) );
		// What is left out is decided by the registry alone: no list of add-on types.
		$schema  = array( 'fields' => array_merge( $nodes, array( array( 'type' => 'example_gauge', 'key' => 'g' ) ) ) );
		$missing = FieldTypeAvailability::unregistered( $schema, self::registry() );
		$this->assertEqualsCanonicalizing( array( 'signature', 'calculation', 'example_gauge' ), $missing );
		$this->assertSame( array(), FieldTypeAvailability::unregistered( array( 'fields' => array( array( 'type' => 'text', 'key' => 'a' ), array( 'type' => 'picture_choice', 'key' => 'b' ) ) ), self::registry() ) );
	}

	/** The moved payment fields are left out of a saved form's live schema, at any depth, and their answers are dropped. */
	public function test_moved_payment_fields_degrade_without_pro(): void {
		$types  = array( 'payment_amount', 'payment_summary', 'payment_coupon', 'payment_hidden_price' );
		$nodes  = array(
			array( 'type' => 'text', 'key' => 'name' ),
			array( 'type' => 'payment_amount', 'key' => 'amt', 'required' => true ),
			array( 'type' => 'step', 'children' => array( array( 'type' => 'payment_coupon', 'key' => 'cp' ), array( 'type' => 'payment_hidden_price', 'key' => 'fee' ), array( 'type' => 'payment_summary', 'key' => 'sum' ) ) ),
		);
		$out = FieldTypeAvailability::strip( $nodes, $types );
		$this->assertCount( 2, $out );
		$this->assertSame( array(), $out[1]['children'] );
		// Never a validation type of its own: nothing here can reject a submission.
		foreach ( $types as $type ) {
			$this->assertSame( $type, FieldTypeAvailability::validationType( $type ) );
		}
	}

	/** WP2-14: no two-letter globals and no sf_ transients. */
	public function test_globals_and_transients_use_the_full_prefix(): void {
		require_once self::root() . '/src/Support/functions.php';
		$this->assertTrue( function_exists( 'subtleforms_is_pro_active' ) );
		foreach ( array( 'sf_is_pro_active', 'sf_is_feature_enabled', 'sf_show_upgrade_notice' ) as $old ) {
			$this->assertFalse( function_exists( $old ), "{$old} is gone" );
		}
		foreach ( array( 'src/Uploads/Uploads.php' ) as $file ) {
			$this->assertDoesNotMatchRegularExpression( "#'sf_(upload|rl_view)_#", (string) file_get_contents( self::root() . '/' . $file ) );
		}
	}

	/** WP2-01, WP2-02, PRO2-06: no Pro gate or Pro copy left on free routes. */
	public function test_free_routes_have_no_pro_gate(): void {
		$export = (string) file_get_contents( self::root() . '/src/Api/SubmissionsApi.php' );
		$this->assertStringNotContainsString( 'part of SubtleForms Pro', $export );
		// The analytics routes moved to SubtleForms Pro in 2.7.0.
		$this->assertFileDoesNotExist( self::root() . '/src/Api/AnalyticsApi.php' );
		$this->assertFileDoesNotExist( self::root() . '/src/Api/FunnelApi.php' );
	}

	/** WP2-09, FF2-19: upsell copy is factual, and no sample data poses as a report. */
	public function test_upsell_copy_is_factual(): void {
		$files = array(
			'resources/admin/pages/ReportsPage.jsx',
			'resources/admin/pages/ToolsPage.jsx',
			'resources/admin/components/settings/ExtensionsSettings.jsx',
			'resources/admin/components/MoreFeaturesCard.jsx',
		);
		foreach ( $files as $file ) {
			$source = (string) file_get_contents( self::root() . '/' . $file );
			foreach ( array( 'trapped', 'light up', 'Sample data shown', 'SAMPLE_FORMS', 'unlock as soon as', 'part of Pro' ) as $phrase ) {
				$this->assertStringNotContainsString( $phrase, $source, "{$file} has no '{$phrase}'" );
			}
		}
	}

	/** WP2-03, WP2-06: no "(Pro)" label or license lock on a free control. */
	public function test_free_controls_have_no_pro_label(): void {
		$files = array_merge(
			glob( self::root() . '/src/Fields/*.php' ),
			glob( self::root() . '/resources/admin/components/builder/*.jsx' )
		);
		foreach ( $files as $file ) {
			$source = (string) file_get_contents( $file );
			$this->assertStringNotContainsString( "(Pro)'", $source, basename( $file ) );
			$this->assertStringNotContainsString( 'Activate your license to edit', $source, basename( $file ) );
			$this->assertStringNotContainsString( "isProFeature('logic.conditional.advanced')", $source, basename( $file ) );
		}
	}

	/** Webhook retries follow Settings > Integrations > Webhooks. */
	public function test_webhook_retries_follow_the_setting(): void {
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'ext_webhooks_retries' => 1 );
		$this->assertSame( 1, \SubtleForms\Async\AsyncDispatcher::webhookRetries() );
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'ext_webhooks_retries' => 9 );
		$this->assertSame( 5, \SubtleForms\Async\AsyncDispatcher::webhookRetries() );
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array();
		$this->assertSame( 3, \SubtleForms\Async\AsyncDispatcher::webhookRetries() );
		unset( $GLOBALS['sf_test_options']['subtleforms_settings'] );
	}

	/** A form made with an add-on can be stored again without it; new unknown types are still refused. */
	public function test_the_schema_check_keeps_unregistered_types_only_where_a_form_is_stored(): void {
		$schema = array( 'schema_version' => 1, 'metadata' => array( 'title' => 'T', 'name' => 'T' ), 'fields' => array( array( 'id' => 'a', 'key' => 'a', 'type' => 'example_gauge', 'label' => 'A' ) ) );
		$strict = ( new \SubtleForms\Support\SchemaValidator() )->validateWithErrors( $schema );
		$this->assertNotEmpty( $strict );
		$keeps = ( new \SubtleForms\Support\SchemaValidator() )->keepUnregisteredTypes();
		$this->assertSame( array(), $keeps->validateWithErrors( $schema ) );
		$schema['fields'][0]['type'] = 'Not A Type!';
		$this->assertNotEmpty( $keeps->validateWithErrors( $schema ) );
	}
}
