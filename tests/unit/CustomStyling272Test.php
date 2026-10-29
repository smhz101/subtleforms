<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 2.7.2: more styling tokens and the theme's own colours and fonts.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Frontend\FrontendAssets;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\Appearance;

final class CustomStyling272Test extends TestCase {

	private function tokens( array $tokens ): array {
		return Appearance::sanitizeForm( array( 'tokens' => $tokens ) )['tokens'] ?? array();
	}

	public function test_good_values_are_kept(): void {
		$good = array(
			'colorLabel'         => 'var(--wp--preset--color--accent-3)',
			'colorLink'          => '#0a5',
			'colorPlaceholder'   => 'rgba(0, 0, 0, 0.5)',
			'colorSuccess'       => 'hsl(120, 50%, 30%)',
			'choiceAccent'       => 'var(--wp--preset--color--primary)',
			'labelFont'          => 'var(--wp--preset--font-family--manrope)',
			'inputFont'          => "'Fira Code', monospace",
			'fontSize'           => 'var(--wp--preset--font-size--large)',
			'labelSize'          => '14px',
			'inputSize'          => '1rem',
			'labelLetterSpacing' => '-0.02em',
			'labelLineHeight'    => '1.4',
			'labelTransform'     => 'uppercase',
			'inputWeight'        => '500',
			'titleWeight'        => '800',
			'borderStyle'        => 'dashed',
			'fieldShadow'        => 'medium',
			'focusStyle'         => 'ring',
			'buttonShadow'       => 'subtle',
			'formAlign'          => 'center',
			'formMaxWidth'       => '60%',
			'columnGap'          => '24px',
			'buttonPaddingX'     => '2rem',
		);
		$this->assertSame( $good, $this->tokens( $good ) );
	}

	public function test_hostile_and_out_of_range_values_are_dropped(): void {
		$bad = array(
			'colorLabel'       => 'var(--evil)',
			'colorLink'        => 'url(https://x.test/a.png)',
			'colorPlaceholder' => 'red; background: url(x)',
			'colorSuccess'     => 'var(--wp--preset--font-family--body)',
			'choiceAccent'     => 'expression(alert(1))',
			'labelFont'        => 'var(--wp--preset--font-family--a);color:red',
			'inputFont'        => 'Arial; } body { display:none',
			'fontSize'         => 'var(--wp--preset--color--primary)',
			'labelSize'        => '400px',
			'inputSize'        => '1vh',
			'titleSize'        => '-3px',
			'labelLineHeight'  => '9',
			'labelTransform'   => 'uppercase; color:red',
			'inputWeight'      => '900',
			'borderStyle'      => 'double',
			'fieldShadow'      => '0 0 9px red',
			'focusStyle'       => 'glow',
			'formAlign'        => 'right',
			'formMaxWidth'     => '5000px',
			'columnGap'        => '200px',
			'choiceSize'       => '4px',
			'madeUp'           => '1px',
		);
		$this->assertSame( array(), $this->tokens( $bad ) );
	}

	public function test_prepare_stored_schema_strips_custom_css(): void {
		$schema = array(
			'metadata' => array(
				'type'       => 'regular',
				'appearance' => array(
					'preset'    => 'theme',
					'tokens'    => array( 'labelSize' => '15px' ),
					'customCss' => '.subtleforms-button{color:red}',
				),
			),
			'fields'   => array( array( 'type' => 'text', 'key' => 'a', 'label' => 'A' ) ),
		);
		$out = FormsRepository::prepareStoredSchema( $schema );
		$this->assertArrayNotHasKey( 'customCss', $out['metadata']['appearance'] );
		$this->assertSame( '15px', $out['metadata']['appearance']['tokens']['labelSize'] );
	}

	public function test_arbitrary_custom_css_is_stripped_on_sanitize(): void {
		$sent = array(
			'preset'    => 'theme',
			'tokens'    => array( 'labelSize' => '15px' ),
			'customCss' => '.subtleforms-button{letter-spacing:2px}',
		);
		$clean = Appearance::sanitizeForm( $sent );
		$this->assertArrayNotHasKey( 'customCss', $clean );
		$this->assertSame( '15px', $clean['tokens']['labelSize'] );
		$this->assertSame( 'theme', $clean['preset'] );
	}

	public function test_an_untouched_theme_form_is_unchanged_from_2_7(): void {
		$schema = array(
			'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'theme' ) ),
			'fields'   => array( array( 'type' => 'text', 'key' => 'a' ) ),
		);
		$this->assertTrue( FrontendAssets::isPlainThemeForm( $schema ) );
		// The only CSS it gets is the 2.7 layout lines.
		$this->assertSame( 'a49d7b177ba961146f36a08ce1e134aa', md5( FrontendAssets::layoutCss() ) ); // 2.7 layout lines plus the 2.7.2 flag rule.
		$this->assertStringNotContainsString( 'var(--subtleforms-label', FrontendAssets::layoutCss() );
		// A legacy customCss key must not force the stylesheet; Free never renders it.
		$schema['metadata']['appearance']['customCss'] = '.a{color:red}';
		$this->assertTrue( FrontendAssets::isPlainThemeForm( $schema ) );
	}

	public function test_a_touched_theme_form_and_a_custom_preset_need_the_stylesheet(): void {
		$fields = array( array( 'type' => 'text', 'key' => 'a' ) );
		foreach ( array( 'colorLabel' => 'var(--wp--preset--color--accent-3)', 'buttonRadius' => '12px', 'labelSize' => '14px' ) as $key => $value ) {
			$schema = array( 'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'theme', 'tokens' => array( $key => $value ) ) ), 'fields' => $fields );
			$this->assertFalse( FrontendAssets::isPlainThemeForm( $schema ), $key );
		}
		$custom = array( 'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'minimal', 'tokens' => array( 'labelSize' => '14px' ) ) ), 'fields' => $fields );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $custom ) );
	}

	public function test_theme_font_size_variables_survive_on_ranged_size_tokens(): void {
		$tokens = array();
		foreach ( array( 'labelSize', 'inputSize', 'helpSize', 'titleSize', 'buttonSize' ) as $key ) {
			$tokens[ $key ] = 'var(--wp--preset--font-size--large)';
		}
		$tokens['labelGap'] = 'var(--wp--preset--font-size--large)';
		$clean = array( 'tokens' => $this->tokens( $tokens ) );
		foreach ( array( 'labelSize', 'inputSize', 'helpSize', 'titleSize', 'buttonSize' ) as $key ) {
			$this->assertSame( 'var(--wp--preset--font-size--large)', $clean['tokens'][ $key ], $key );
		}
		$this->assertArrayNotHasKey( 'labelGap', $clean['tokens'] );
	}
}
