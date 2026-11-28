<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * The uploads privacy notice names the server fix in order: explain, fix,
 * check again, host line (issue 224).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace {
if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $text, $domain = 'default' ) {
		return htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' );
	}
}
if ( ! function_exists( 'esc_url' ) ) {
	function esc_url( $url ) {
		return htmlspecialchars( (string) $url, ENT_QUOTES, 'UTF-8' );
	}
}
if ( ! function_exists( 'wp_upload_dir' ) ) {
	function wp_upload_dir( $time = null, $create = true ) {
		return array( 'baseurl' => 'https://example.test/wp-content/uploads', 'basedir' => '/nonexistent/uploads' );
	}
}
}

namespace SubtleForms\Tests\Unit {

use PHPUnit\Framework\TestCase;
use SubtleForms\Uploads\UploadsExposure;

/**
 * Separate processes: other tests define a wp_upload_dir() stub without baseurl.
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class UploadsNotice224Test extends TestCase {

	private const FOLDER = 'subtleforms-uploads-0123456789abcdef';

	protected function setUp(): void {
		$GLOBALS['sf_test_options']['subtleforms_upload_folder'] = self::FOLDER;
	}

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_options']['subtleforms_upload_folder'] );
	}

	private function render( string $kind ): string {
		ob_start();
		UploadsExposure::renderNotice( $kind, 'https://example.test/site-health.php', 'https://example.test/dismiss' );
		return (string) ob_get_clean();
	}

	private function assertInOrder( string $html, array $needles ): void {
		$last = -1;
		foreach ( $needles as $needle ) {
			$pos = strpos( $html, $needle );
			$this->assertNotFalse( $pos, "Missing: $needle" );
			$this->assertGreaterThan( $last, $pos, "Out of order: $needle" );
			$last = $pos;
		}
	}

	public function test_server_kind(): void {
		$this->assertSame( 'nginx', UploadsExposure::serverKind( 'nginx/1.25.3' ) );
		$this->assertSame( 'nginx', UploadsExposure::serverKind( 'openresty nginx' ) );
		$this->assertSame( 'apache', UploadsExposure::serverKind( 'Apache/2.4.58 (Unix)' ) );
		$this->assertSame( 'apache', UploadsExposure::serverKind( 'LiteSpeed' ) );
		$this->assertSame( 'unknown', UploadsExposure::serverKind( '' ) );
		$this->assertSame( 'unknown', UploadsExposure::serverKind( 'Caddy' ) );
	}

	public function test_nginx_notice_order(): void {
		$html = $this->render( 'nginx' );
		$this->assertInOrder( $html, array(
			'Your server ignores the folder rules',
			'Add this rule to your nginx site configuration:',
			'<pre><code>location ^~ /wp-content/uploads/' . self::FOLDER . '/',
			'Reload nginx, then check again in Tools &gt; Site Health.',
			'If you cannot edit the server configuration, send this to your host.',
			'Open Site Health',
		) );
		$this->assertStringNotContainsString( 'AllowOverride', $html );
	}

	public function test_apache_notice_order(): void {
		$html = $this->render( 'apache' );
		$this->assertInOrder( $html, array(
			'Your server ignores the folder rules',
			'AllowOverride) or to block this folder:',
			'<code>/wp-content/uploads/' . self::FOLDER . '/</code>',
			'Then check again in Tools &gt; Site Health.',
			'If you cannot edit the server configuration, send this to your host.',
			'Open Site Health',
		) );
		$this->assertStringNotContainsString( 'nginx', $html );
	}

	public function test_unknown_notice_shows_both(): void {
		$html = $this->render( 'unknown' );
		$this->assertInOrder( $html, array(
			'Your server ignores the folder rules',
			'Add this rule to your nginx site configuration:',
			'<pre><code>',
			'Reload nginx, then check again',
			'On Apache or LiteSpeed, ask your host to allow .htaccess files (AllowOverride) in this folder.',
			'If you cannot edit the server configuration, send this to your host.',
			'Open Site Health',
		) );
	}
}

}
