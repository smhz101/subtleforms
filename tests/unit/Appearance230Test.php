<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\Appearance;

/**
 * 2.3.0: inline layout variant, dark-surface preset tokens, and the 2.0
 * tokens that used to be dropped on save.
 *
 * @covers \SubtleForms\Support\Appearance
 */
final class Appearance230Test extends TestCase {

	public function test_inline_layout_variant_is_kept() {
		$clean = Appearance::sanitizeForm( array( 'variants' => array( 'layout' => 'inline' ) ) );
		$this->assertSame( 'inline', $clean['variants']['layout'] );
		$clean = Appearance::sanitizeForm( array( 'variants' => array( 'layout' => 'grid' ) ) );
		$this->assertArrayNotHasKey( 'variants', $clean );
	}

	public function test_dark_surface_tokens_survive() {
		$clean = Appearance::sanitizeForm(
			array(
				'preset' => 'dark-surface',
				'tokens' => array(
					'colorBackground' => 'transparent',
					'colorSurface'    => 'rgba(255, 255, 255, 0.08)',
					'colorButtonText' => '#111318',
					'colorLabel'      => '#f4f5f7',
					'colorInputText'  => '#ffffff',
					'colorFocus'      => '#ffffff',
					'buttonRadius'    => '999px',
					'labelWeight'     => '700',
				),
			)
		);
		$this->assertSame( 'dark-surface', $clean['preset'] );
		$this->assertSame( '#111318', $clean['tokens']['colorButtonText'] );
		$this->assertSame( 'transparent', $clean['tokens']['colorBackground'] );
		$this->assertSame( '999px', $clean['tokens']['buttonRadius'] );
		$this->assertSame( '700', $clean['tokens']['labelWeight'] );
		$this->assertSame( '#ffffff', $clean['tokens']['colorInputText'] );
	}
}
