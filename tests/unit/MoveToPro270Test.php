<?php
/**
 * 2.7.0: picture choice, several files per upload field, advanced
 * conditional logic and form analytics moved to SubtleForms Pro.
 *
 * WordPress.org guideline 5: the free plugin keeps no working code for them,
 * only the extension points Pro builds on, a plain fallback for forms that
 * already use them, and Pro placeholders. These tests fail if the code comes
 * back, and check the fallbacks.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\AddonFieldTypes;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldDefinition;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;
use SubtleForms\Fields\FieldsV2;
use SubtleForms\Support\ExtensionPoints;
use SubtleForms\Support\SchemaValidator;

final class MoveToPro270Test extends TestCase {

	private static function root(): string {
		return dirname( __DIR__, 2 );
	}

	/** @return string[] Source files of the plugin (PHP and JS), not tests or builds. */
	private static function sources(): array {
		$out = array();
		foreach ( array( 'src', 'resources' ) as $dir ) {
			$it = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( self::root() . '/' . $dir, \FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $file ) {
				$path = $file->getPathname();
				if ( preg_match( '/\.(php|js|jsx|scss|css)$/', $path ) && ! preg_match( '/\.test\.(js|jsx)$/', $path ) ) {
					$out[] = $path;
				}
			}
		}
		return $out;
	}

	// ── Guideline 5: nothing that works is left ─────────────────────

	public function test_the_code_of_the_moved_features_is_gone(): void {
		foreach (
			array(
				'src/Analytics/Stats.php',
				'src/Analytics/Funnel.php',
				'src/Api/AnalyticsApi.php',
				'src/Api/FunnelApi.php',
				'src/Extensions/AnalyticsExtension.php',
				'resources/frontend/utils/viewBeacon.js',
				'resources/frontend/utils/funnelTracker.js',
				'resources/admin/components/analytics/FormAnalyticsPanel.jsx',
				'resources/admin/components/analytics/FunnelPanel.jsx',
				'resources/admin/components/analytics/PerformanceCell.jsx',
				'resources/admin/components/analytics/useAnalytics.js',
				'resources/admin/components/settings/extensions/AnalyticsPanel.jsx',
			) as $file
		) {
			$this->assertFileDoesNotExist( self::root() . '/' . $file, $file );
		}
		// The spam card is not analytics: it stays.
		$this->assertFileExists( self::root() . '/src/Analytics/SpamStats.php' );
	}

	public function test_no_source_file_still_holds_a_moved_feature(): void {
		$forbidden = array(
			'subtleforms-picture-choice',
			'sf-field-renderer__picture',
			'openMediaPicker',
			'wp_enqueue_media',
			'trackViews',
			'trackFunnel',
			'subtleforms_stats_db',
			'subtleforms_funnel_db',
			"prefix . 'subtleforms_stats",
			"prefix . 'subtleforms_funnel",
			'usesAdvancedLogic',
			'ADVANCED_OPERATORS',
			'upload--multiple',
			'subtleforms-upload__drop',
		);
		foreach ( self::sources() as $path ) {
			$source = (string) file_get_contents( $path );
			foreach ( $forbidden as $needle ) {
				$this->assertStringNotContainsString( $needle, $source, str_replace( self::root() . '/', '', $path ) . ' has ' . $needle );
			}
		}
	}

	public function test_the_advanced_operators_are_not_evaluated(): void {
		$source = (string) file_get_contents( self::root() . '/src/Engine/ConditionalLogic.php' );
		foreach ( array( "case 'starts_with'", "case 'ends_with'", "case 'between'", "case 'before'", "case 'after'", "case 'in'", "case 'not_in'" ) as $case ) {
			$this->assertStringNotContainsString( $case, $source, $case );
		}
		$js = (string) file_get_contents( self::root() . '/resources/shared/conditions.js' );
		foreach ( array( "case 'starts_with'", "case 'between'", "case 'before'" ) as $case ) {
			$this->assertStringNotContainsString( $case, $js, $case );
		}
	}

	public function test_picture_choice_is_not_registered_by_the_plugin(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		FieldsV2::register( $registry );
		$this->assertFalse( $registry->has( 'picture_choice' ) );
		$this->assertTrue( $registry->has( 'toggle' ) );
		$this->assertTrue( $registry->has( 'scale' ) );
	}

	// ── Extension points ────────────────────────────────────────────

	public function test_every_extension_point_is_declared(): void {
		$this->assertSame( array( 'picture_choice', 'multi_file_uploads', 'advanced_logic', 'analytics' ), ExtensionPoints::all() );
		$this->assertSame( 2, ExtensionPoints::LEVEL );
		foreach ( ExtensionPoints::all() as $point ) {
			$this->assertTrue( ExtensionPoints::has( $point ) );
		}
		$this->assertFalse( ExtensionPoints::has( 'made_up' ) );
	}

	public function test_nothing_is_provided_until_an_add_on_says_so(): void {
		$this->assertSame( array(), ExtensionPoints::provided() );
		$GLOBALS['sf_test_filters']['subtleforms/addon/features'] = static fn() => array( 'analytics', 'made_up', 'picture_choice' );
		try {
			$this->assertSame( array( 'picture_choice', 'analytics' ), ExtensionPoints::provided(), 'Only known points, in the declared order.' );
			$this->assertTrue( ExtensionPoints::isProvided( 'analytics' ) );
			$this->assertFalse( ExtensionPoints::isProvided( 'advanced_logic' ) );
		} finally {
			unset( $GLOBALS['sf_test_filters']['subtleforms/addon/features'] );
		}
	}

	// ── Picture choice degrades to a plain choice ───────────────────

	public function test_picture_choice_is_a_known_type_with_a_plain_fallback(): void {
		$this->assertContains( 'picture_choice', AddonFieldTypes::knownTypes() );
		$this->assertNotContains( 'picture_choice', AddonFieldTypes::types(), 'It is not "missing": the live form still shows it.' );
		$registry = new FieldRegistry();
		$this->assertSame( 'radio', AddonFieldTypes::effectiveType( 'picture_choice', array(), $registry ) );
		$this->assertSame( 'radio', AddonFieldTypes::effectiveType( 'picture_choice', array( 'allowMultiple' => false ), $registry ) );
		$this->assertSame( 'multiple_choice', AddonFieldTypes::effectiveType( 'picture_choice', array( 'allowMultiple' => true ), $registry ) );
		$this->assertSame( 'multiple_choice', AddonFieldTypes::effectiveType( 'picture_choice', array( 'config' => array( 'allowMultiple' => true ) ), $registry ) );
		$this->assertSame( 'text', AddonFieldTypes::effectiveType( 'text', array(), $registry ) );
	}

	public function test_an_add_on_that_registers_picture_choice_keeps_its_type(): void {
		$registry = new FieldRegistry();
		$registry->register( new FieldDefinition( type: 'picture_choice', label: 'Picture Choice', category: 'choices', icon: 'x', kind: 'input' ) );
		$this->assertSame( 'picture_choice', AddonFieldTypes::effectiveType( 'picture_choice', array( 'allowMultiple' => true ), $registry ) );
	}

	public function test_the_server_checks_picture_choice_as_a_plain_choice_even_when_an_add_on_registers_it(): void {
		$this->assertSame( 'radio', AddonFieldTypes::validationType( 'picture_choice', array() ) );
		$this->assertSame( 'multiple_choice', AddonFieldTypes::validationType( 'picture_choice', array( 'allowMultiple' => true ) ) );
		$this->assertSame( 'text', AddonFieldTypes::validationType( 'text' ) );
	}

	public function test_the_schema_check_accepts_a_saved_picture_choice(): void {
		$source = (string) file_get_contents( self::root() . '/src/Support/SchemaValidator.php' );
		$this->assertStringContainsString( 'AddonFieldTypes::knownTypes()', $source );
	}

	public function test_a_picture_choice_is_checked_like_a_radio_group(): void {
		$options = array( array( 'label' => 'Cat', 'value' => 'cat', 'image' => 'x.png' ), array( 'label' => 'Dog', 'value' => 'dog', 'image' => 'y.png' ) );
		$schema  = array( 'fields' => array( array( 'key' => 'pet', 'type' => 'picture_choice', 'label' => 'Pet', 'options' => $options, 'required' => true ) ) );
		$v       = new FieldValidator();
		$this->assertTrue( $v->validate( $schema, array( 'pet' => 'cat' ), array() )['valid'] );
		$this->assertFalse( $v->validate( $schema, array( 'pet' => 'fish' ), array() )['valid'] );
		$this->assertFalse( $v->validate( $schema, array( 'pet' => array( 'cat', 'dog' ) ), array() )['valid'], 'One answer only.' );
		$this->assertFalse( $v->validate( $schema, array(), array() )['valid'], 'Required still applies.' );
	}

	public function test_a_multiple_picture_choice_is_checked_like_a_checkbox_group(): void {
		$options = array( array( 'label' => 'Cat', 'value' => 'cat' ), array( 'label' => 'Dog', 'value' => 'dog' ) );
		$schema  = array( 'fields' => array( array( 'key' => 'pet', 'type' => 'picture_choice', 'label' => 'Pet', 'options' => $options, 'allowMultiple' => true, 'minChoices' => 2 ) ) );
		$v       = new FieldValidator();
		$this->assertTrue( $v->validate( $schema, array( 'pet' => array( 'cat', 'dog' ) ), array() )['valid'] );
		$this->assertFalse( $v->validate( $schema, array( 'pet' => array( 'cat' ) ), array() )['valid'], 'The minimum still applies.' );
		$this->assertFalse( $v->validate( $schema, array( 'pet' => array( 'cat', 'fish' ) ), array() )['valid'] );
	}

	/** @return array<int,array<string,mixed>> Inspector controls of a file upload field. */
	private static function uploadControls(): array {
		$definition = new FieldDefinition( 'file_upload', 'File upload', 'media', 'upload' );
		FieldSettings::decorate( $definition );
		return $definition->inspectorControls;
	}

	// ── Placeholders and the settings of the moved fields ───────────

	public function test_uploads_have_no_locked_several_files_control(): void {
		$controls = self::uploadControls();
		$this->assertEmpty( array_filter( $controls, static fn( $c ) => 'multiple' === ( $c['name'] ?? '' ) ), 'No several files control or note without an add-on.' );
		$this->assertEmpty( array_filter( $controls, static fn( $c ) => 'pro_notice' === ( $c['type'] ?? '' ) ) );
		$this->assertEmpty( array_filter( $controls, static fn( $c ) => 'maxFiles' === ( $c['name'] ?? '' ) ), 'No limit control without the feature.' );
	}

	public function test_an_add_on_adds_its_upload_controls_through_the_filter(): void {
		$GLOBALS['sf_test_filters']['subtleforms/fields/inspector_controls'] = static function ( $controls, $type ) {
			if ( 'file_upload' === $type ) {
				$controls[] = array( 'type' => 'toggle', 'name' => 'multiple', 'label' => 'Allow several files' );
			}
			return $controls;
		};
		try {
			$controls = self::uploadControls();
			$types    = array_column( array_filter( $controls, static fn( $c ) => 'multiple' === ( $c['name'] ?? '' ) ), 'type' );
			$this->assertSame( array( 'toggle' ), array_values( $types ) );
		} finally {
			unset( $GLOBALS['sf_test_filters']['subtleforms/fields/inspector_controls'] );
		}
	}

	public function test_settings_of_the_moved_features_are_not_in_the_plugin(): void {
		$settings = (string) file_get_contents( self::root() . '/src/Support/Settings.php' );
		$this->assertStringNotContainsString( 'ext_analytics_', $settings );
		$this->assertFalse( ( new \SubtleForms\Support\Capabilities() )->allows( 'logic.conditional.advanced' ) );
	}
}
