<?php
/**
 * Readme checks for the WordPress.org guidelines (WP2-10, WP2-11).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class ReadmeLint250Test extends TestCase {

	private static function readme(): string {
		return (string) file_get_contents( dirname( __DIR__, 2 ) . '/readme.txt' );
	}

	/** The text of one `== Heading ==` section. */
	private static function section( string $heading ): string {
		$parts = preg_split( '/^== (.+?) ==\s*$/m', self::readme(), -1, PREG_SPLIT_DELIM_CAPTURE );
		for ( $i = 1; $i < count( $parts ) - 1; $i += 2 ) {
			if ( $heading === trim( $parts[ $i ] ) ) {
				return $parts[ $i + 1 ];
			}
		}
		return '';
	}

	/** WP2-10: the readme has an External services section naming each service the plugin can call. */
	public function test_external_services_section_names_every_service(): void {
		$section = self::section( 'External services' );
		$this->assertNotSame( '', $section, 'readme.txt needs an "External services" section.' );
		foreach ( array( 'Google reCAPTCHA', 'hCaptcha', 'Cloudflare Turnstile', 'Webhooks' ) as $name ) {
			$this->assertStringContainsString( "= {$name} =", $section, "{$name} is described." );
		}
	}

	/** WP2-10: every captcha provider lists what is sent, where, and links its terms and privacy policy. */
	public function test_each_captcha_provider_lists_data_endpoint_and_policies(): void {
		$section = self::section( 'External services' );
		foreach ( array( 'Google reCAPTCHA', 'hCaptcha', 'Cloudflare Turnstile' ) as $name ) {
			$block = '';
			if ( preg_match( '/^= ' . preg_quote( $name, '/' ) . ' =\s*(.*?)(?=^= |\z)/ms', $section, $m ) ) {
				$block = $m[1];
			}
			$this->assertNotSame( '', $block, "{$name} has text." );
			$this->assertMatchesRegularExpression( '#https://\S*siteverify#', $block, "{$name} names the address the site sends to." );
			$this->assertStringContainsString( 'Privacy Policy', $block, "{$name} links its privacy policy." );
			$this->assertMatchesRegularExpression( '/Terms of (Service|Use)/', $block, "{$name} links its terms." );
		}
	}

	/** WP2-10: the endpoints the readme names are the ones the code calls. */
	public function test_readme_endpoints_match_the_code(): void {
		$code = '';
		$iterator = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( dirname( __DIR__, 2 ) . '/src', \FilesystemIterator::SKIP_DOTS ) );
		foreach ( $iterator as $file ) {
			if ( 'php' === $file->getExtension() ) {
				$code .= (string) file_get_contents( $file->getPathname() );
			}
		}
		$section = self::section( 'External services' );
		preg_match_all( '#https://\S*siteverify#', $section, $urls );
		$this->assertNotEmpty( $urls[0] );
		foreach ( array_unique( $urls[0] ) as $url ) {
			$this->assertStringContainsString( rtrim( $url, '.,)' ), $code, "{$url} is in the code." );
		}
	}

	/** WP2-11: the contributors are accounts of this project and nobody else. */
	public function test_contributors_are_project_accounts_only(): void {
		$this->assertSame( 1, preg_match( '/^Contributors:\s*(.+)$/m', self::readme(), $m ) );
		$names = array_map( 'trim', explode( ',', $m[1] ) );
		$this->assertContains( 'smhz101', $names );
		$this->assertSame( array(), array_diff( $names, array( 'smhz101', 'subtleforms' ) ), 'No other person account is listed.' );
	}
}
