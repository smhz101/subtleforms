<?php

/**
 * Unit tests for SubtleForms\Support\Appearance
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\Appearance;

/**
 * @covers \SubtleForms\Support\Appearance
 */
final class AppearanceTest extends TestCase {

	// ── shape ──────────────────────────────────────────────────────────

	public function test_non_array_input_yields_empty_array(): void {
		$this->assertSame( array(), Appearance::sanitizeForm( null ) );
		$this->assertSame( array(), Appearance::sanitizeForm( 'red' ) );
		$this->assertSame( array(), Appearance::sanitizeField( 42 ) );
	}

	public function test_preset_id_is_slugified_and_bounded(): void {
		$clean = Appearance::sanitizeForm( array( 'preset' => 'Soft' ) );
		$this->assertSame( 'soft', $clean['preset'] );

		$clean = Appearance::sanitizeForm( array( 'preset' => 'a<script>b' ) );
		$this->assertSame( 'ascriptb', $clean['preset'] );
	}

	// ── colours ────────────────────────────────────────────────────────

	public function test_hex_colours_are_kept(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'colorPrimary' => '#FF0000' ) )
		);
		$this->assertSame( '#ff0000', $clean['tokens']['colorPrimary'] );
	}

	public function test_short_and_alpha_hex_are_kept(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'colorText' => '#abc', 'colorBorder' => '#11223344' ) )
		);
		$this->assertSame( '#abc', $clean['tokens']['colorText'] );
		$this->assertSame( '#11223344', $clean['tokens']['colorBorder'] );
	}

	public function test_functional_colours_are_kept(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'colorPrimary' => 'rgba(10, 20, 30, 0.5)' ) )
		);
		$this->assertSame( 'rgba(10, 20, 30, 0.5)', $clean['tokens']['colorPrimary'] );
	}

	/**
	 * A custom property is consumed by a real declaration, so a url() in one
	 * still makes a request. It must not survive storage.
	 */
	public function test_url_in_a_colour_is_dropped(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'colorBackground' => 'url(https://evil.test/track.png)' ) )
		);
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	public function test_expression_and_escape_attempts_are_dropped(): void {
		foreach ( array( 'red; background: url(x)', 'expression(alert(1))', 'var(--x)' ) as $value ) {
			$clean = Appearance::sanitizeForm(
				array( 'tokens' => array( 'colorText' => $value ) )
			);
			$this->assertArrayNotHasKey( 'tokens', $clean, "Accepted: {$value}" );
		}
	}

	// ── lengths ────────────────────────────────────────────────────────

	public function test_lengths_with_known_units_are_kept(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'radius' => '8px', 'fontSize' => '1.25rem' ) )
		);
		$this->assertSame( '8px', $clean['tokens']['radius'] );
		$this->assertSame( '1.25rem', $clean['tokens']['fontSize'] );
	}

	public function test_bare_zero_is_kept_but_other_unitless_values_are_not(): void {
		$clean = Appearance::sanitizeForm( array( 'tokens' => array( 'radius' => '0' ) ) );
		$this->assertSame( '0', $clean['tokens']['radius'] );

		$clean = Appearance::sanitizeForm( array( 'tokens' => array( 'radius' => '12' ) ) );
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	public function test_unknown_unit_is_dropped(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'radius' => '8furlongs' ) )
		);
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	// ── enums and unknown keys ─────────────────────────────────────────

	public function test_enum_token_is_constrained(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'labelWeight' => '600' ) )
		);
		$this->assertSame( '600', $clean['tokens']['labelWeight'] );

		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'labelWeight' => '900' ) )
		);
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	public function test_unknown_token_key_is_dropped(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'somethingElse' => '#fff' ) )
		);
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	public function test_empty_values_are_dropped_rather_than_stored(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'colorPrimary' => '', 'radius' => '   ' ) )
		);
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	// ── variants ───────────────────────────────────────────────────────

	public function test_known_variants_are_kept_and_unknown_dropped(): void {
		$clean = Appearance::sanitizeForm(
			array(
				'variants' => array(
					'input'       => 'filled',
					'button'      => 'nonsense',
					'buttonAlign' => 'center',
				),
			)
		);

		$this->assertSame( 'filled', $clean['variants']['input'] );
		$this->assertSame( 'center', $clean['variants']['buttonAlign'] );
		$this->assertArrayNotHasKey( 'button', $clean['variants'] );
	}

	// ── fonts ──────────────────────────────────────────────────────────

	public function test_font_stack_of_names_is_kept(): void {
		$stack = "-apple-system, 'Segoe UI', Helvetica, sans-serif";
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'fontFamily' => $stack ) )
		);
		$this->assertSame( $stack, $clean['tokens']['fontFamily'] );
	}

	public function test_font_stack_containing_a_function_is_dropped(): void {
		$clean = Appearance::sanitizeForm(
			array( 'tokens' => array( 'fontFamily' => 'url(https://evil.test/f.woff)' ) )
		);
		$this->assertArrayNotHasKey( 'tokens', $clean );
	}

	// ── fields ─────────────────────────────────────────────────────────

	public function test_field_layout_values_are_constrained(): void {
		$clean = Appearance::sanitizeField(
			array( 'width' => '50', 'align' => 'center', 'marginTop' => '8px' )
		);

		$this->assertSame( '50', $clean['width'] );
		$this->assertSame( 'center', $clean['align'] );
		$this->assertSame( '8px', $clean['marginTop'] );
	}

	public function test_field_rejects_widths_outside_the_offered_set(): void {
		$clean = Appearance::sanitizeField( array( 'width' => '37' ) );
		$this->assertArrayNotHasKey( 'width', $clean );
	}

	public function test_field_show_flags_is_kept_when_turned_off(): void {
		$off = Appearance::sanitizeField( array( 'showFlags' => false ) );
		$this->assertArrayHasKey( 'showFlags', $off );
		$this->assertFalse( $off['showFlags'] );

		$on = Appearance::sanitizeField( array( 'showFlags' => true ) );
		$this->assertTrue( $on['showFlags'] );

		$this->assertArrayNotHasKey( 'showFlags', Appearance::sanitizeField( array() ) );
	}

	public function test_field_hide_label_is_normalised_to_a_boolean(): void {
		$this->assertTrue( Appearance::sanitizeField( array( 'hideLabel' => '1' ) )['hideLabel'] );
		$this->assertArrayNotHasKey(
			'hideLabel',
			Appearance::sanitizeField( array( 'hideLabel' => false ) )
		);
	}

	public function test_theme_layout_and_width_are_kept(): void {
		$clean = Appearance::sanitizeForm(
			array(
				'preset'   => 'theme',
				'variants' => array(
					'layout' => 'inherit',
					'width'  => 'theme',
				),
			)
		);

		$this->assertSame( 'theme', $clean['preset'] );
		$this->assertSame( 'inherit', $clean['variants']['layout'] );
		$this->assertSame( 'theme', $clean['variants']['width'] );
	}

	public function test_preview_breakpoints_use_standards_when_the_theme_says_nothing(): void {
		$this->assertSame(
			array(
				'desktop' => 1280,
				'tablet'  => 768,
				'mobile'  => 390,
			),
			Appearance::previewBreakpoints( array() )
		);
	}

	public function test_preview_breakpoints_inherit_theme_sizes_and_stay_distinct(): void {
		$this->assertSame(
			array(
				'desktop' => 1200,
				'tablet'  => 720,
				'mobile'  => 390,
			),
			Appearance::previewBreakpoints(
				array(
					'layout' => array(
						'wideSize'    => '1200px',
						'contentSize' => '720px',
					),
				)
			)
		);

		$named = Appearance::previewBreakpoints(
			array(
				'custom' => array(
					'breakpoints' => array(
						'desktop' => '1440px',
						'tablet'  => '834px',
						'mobile'  => '390px',
					),
				),
				'layout' => array( 'wideSize' => '1200px' ),
			)
		);
		$this->assertSame( 1440, $named['desktop'] );
		$this->assertSame( 834, $named['tablet'] );
		$this->assertSame( 390, $named['mobile'] );

		// Mobile above tablet must not leave desktop narrower than tablet.
		$ordered = Appearance::previewBreakpoints(
			array(
				'custom' => array(
					'breakpoints' => array(
						'desktop' => '1000px',
						'tablet'  => '800px',
						'mobile'  => '900px',
					),
				),
			)
		);
		$this->assertGreaterThan( $ordered['tablet'], $ordered['desktop'] );
		$this->assertGreaterThan( $ordered['mobile'], $ordered['tablet'] );
	}
}
