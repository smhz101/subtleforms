<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Notice, Section Heading and Page Break settings are tagged with the panel
 * they are drawn in (FA-02), and the Fixed Fee help says what its
 * description is used for (PAY-18).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;

final class LayoutInspectorTest extends TestCase {

	private static ?FieldRegistry $registry = null;

	private static function sections( string $type ): array {
		if ( ! self::$registry ) {
			self::$registry = new FieldRegistry();
			CoreFields::register( self::$registry );
			\SubtleForms\Fields\FieldsV2::register( self::$registry );
			\SubtleForms\Fields\PaymentFields::register( self::$registry );
			FieldSettings::decorateAll( self::$registry );
		}
		$def = self::$registry->get( $type );
		$out = array();
		foreach ( (array) $def->layoutControls as $c ) {
			$out[ $c['name'] ] = $c['section'] ?? null;
		}
		return $out;
	}

	public function test_notice_text_is_general_and_style_is_appearance(): void {
		$this->assertSame( array( 'content' => 'general', 'variant' => 'appearance' ), self::sections( 'disclaimer' ) );
	}

	public function test_section_heading_and_page_break_titles_are_general(): void {
		$this->assertSame( array( 'title' => 'general', 'description' => 'general' ), self::sections( 'section_break' ) );
		$this->assertSame( array( 'title' => 'general', 'description' => 'general' ), self::sections( 'step' ) );
	}

	public function test_fixed_fee_description_help_names_the_order_line(): void {
		self::sections( 'step' );
		$def  = self::$registry->get( 'payment_hidden_price' );
		$help = '';
		foreach ( (array) $def->inspectorControls as $c ) {
			if ( ( $c['name'] ?? '' ) === 'description' ) {
				$help = (string) ( $c['help'] ?? '' );
			}
		}
		$this->assertStringNotContainsString( 'debugging', $help );
		$this->assertStringContainsString( 'order summary', $help );
	}
}
