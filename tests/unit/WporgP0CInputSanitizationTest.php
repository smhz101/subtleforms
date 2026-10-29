<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * WordPress.org Package C: input sanitization / validation (P0-3).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Admin\AdminMenu;
use SubtleForms\Api\ClassicResult;
use SubtleForms\Api\PublicSubmitApi;
use SubtleForms\Security\PublicRoutes;
use SubtleForms\Validation\Sanitizer;

final class WporgP0CInputSanitizationTest extends TestCase {


	protected function setUp(): void {
		unset( $GLOBALS['sf_test_nonce'] );
		parent::setUp();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_nonce'], $GLOBALS['sf_test_last_verified_nonce'], $GLOBALS['sf_test_rest_prefix'] );
		if ( isset( $GLOBALS['sf_test_filters']['subtleforms/submission/request_keys'] ) ) {
			unset( $GLOBALS['sf_test_filters']['subtleforms/submission/request_keys'] );
		}
		parent::tearDown();
	}

	public function test_classic_submission_reads_form_id_and_answers_without_flattening(): void {
		$parsed = PublicSubmitApi::classicSubmission(
			array(
				'subtleforms_classic' => '1',
				'subtleforms_form_id' => '9',
				'data'                => array(
					'name'   => 'Ada',
					'notes'  => "line1\nline2",
					'email'  => 'ada@example.com',
					'amount' => '12.5',
					'when'   => '2026-10-29',
					'name_parts' => array(
						'first' => 'Ada',
						'last'  => 'Lovelace',
					),
				),
			)
		);
		$this->assertSame( 9, $parsed['form_id'] );
		$this->assertSame( "line1\nline2", $parsed['data']['notes'] );
		$this->assertSame( 'ada@example.com', $parsed['data']['email'] );
		$this->assertSame( '12.5', $parsed['data']['amount'] );
		$this->assertSame( '2026-10-29', $parsed['data']['when'] );
		$this->assertSame( array( 'first' => 'Ada', 'last' => 'Lovelace' ), $parsed['data']['name_parts'] );
	}

	public function test_classic_result_sanitizes_values_before_they_would_be_stored(): void {
		$outcome = ClassicResult::outcome(
			422,
			array( 'error' => array( 'message' => 'Nope' ) ),
			4,
			array(
				'bio'     => "Hello\n<script>alert(1)</script>World",
				'email'   => 'ada@example.com',
				'count'   => 3,
				'when'    => '2026-01-02',
				'address' => array( 'city' => '<b>London</b>' ),
				'g-recaptcha-response' => 'token',
			)
		);
		$this->assertFalse( $outcome['ok'] );
		$this->assertSame( "Hello\nWorld", $outcome['values']['bio'] );
		$this->assertSame( 'ada@example.com', $outcome['values']['email'] );
		$this->assertSame( 3, $outcome['values']['count'] );
		$this->assertSame( '2026-01-02', $outcome['values']['when'] );
		// No schema in unit stubs → plain strip; nested city is not rich_text.
		$this->assertSame( array( 'city' => 'London' ), $outcome['values']['address'] );
		$this->assertArrayNotHasKey( 'g-recaptcha-response', $outcome['values'] );
		$this->assertStringNotContainsString( '<script>', (string) wp_json_encode( $outcome['values'] ) );
	}

	public function test_sanitizer_preserves_multiline_and_strips_malicious_html(): void {
		$out = Sanitizer::sanitizeArrayDeep(
			array(
				'textarea' => "Keep\nnewlines",
				'html'     => '<img src=x onerror=alert(1)>safe',
				'richish'  => '<p>Hi</p><script>x</script>',
			)
		);
		$this->assertSame( "Keep\nnewlines", $out['textarea'] );
		$this->assertSame( 'safe', $out['html'] );
		$this->assertSame( 'Hi', $out['richish'] );
	}

	public function test_classic_redisplay_preserves_allowlisted_rich_text(): void {
		$out = Sanitizer::sanitizeClassicRedisplay(
			array(
				'notes' => "Keep\nnewlines",
				'bio'   => '<p>Hi</p><script>x</script>',
				'city'  => '<b>London</b>',
				'name'  => 'Tom & Jerry',
			),
			array( 'bio' )
		);
		$this->assertSame( "Keep\nnewlines", $out['notes'] );
		$this->assertSame( '<p>Hi</p>', $out['bio'] );
		$this->assertSame( 'London', $out['city'] );
		// Plain text must not be run through wp_kses (which would turn & into &amp;).
		$this->assertSame( 'Tom & Jerry', $out['name'] );
		$this->assertStringNotContainsString( 'script', $out['bio'] );
	}

	public function test_classic_redisplay_without_rich_keys_strips_all_markup(): void {
		$out = Sanitizer::sanitizeClassicRedisplay(
			array(
				'bio'  => '<p>Hi</p><script>x</script>',
				'name' => 'Tom & Jerry',
			)
		);
		$this->assertSame( 'Hi', $out['bio'] );
		$this->assertSame( 'Tom & Jerry', $out['name'] );
	}

	public function test_field_keys_of_type_walks_columns(): void {
		$keys = Sanitizer::fieldKeysOfType(
			array(
				array(
					'type'    => 'columns',
					'columns' => array(
						array( array( 'type' => 'rich_text', 'key' => 'about' ) ),
						array( array( 'type' => 'text', 'key' => 'title' ) ),
					),
				),
			),
			'rich_text'
		);
		$this->assertSame( array( 'about' ), $keys );
	}

	public function test_sanitize_rich_text_allowlist_keeps_safe_markup(): void {
		// Unit stub of wp_kses returns the string unchanged; assert allowlist shape and API.
		$allowed = Sanitizer::richTextAllowedHtml();
		$this->assertArrayHasKey( 'a', $allowed );
		$this->assertArrayHasKey( 'p', $allowed );
		$this->assertSame( 'Hello', Sanitizer::sanitizeRichText( 'Hello' ) );
		$this->assertSame( '', Sanitizer::sanitizeRichText( array( 'x' => 1 ) ) );
	}

	public function test_sanitize_array_deep_rejects_oversized_nesting_and_objects(): void {
		$deep = array( 'a' => array( 'b' => array( 'c' => array( 'd' => array( 'e' => array( 'f' => array( 'g' => array( 'h' => array( 'i' => 'too deep' ) ) ) ) ) ) ) ) );
		$out  = Sanitizer::sanitizeArrayDeep( $deep );
		// Depth 8: the innermost beyond max becomes [].
		$this->assertIsArray( $out['a']['b']['c']['d']['e']['f']['g']['h'] );
		$this->assertSame( array(), $out['a']['b']['c']['d']['e']['f']['g']['h'] );
		$this->assertSame( array(), Sanitizer::sanitizeArrayDeep( 'not-an-array' ) );
	}

	public function test_admin_action_nonce_valid_passes_and_malformed_fails(): void {
		$GLOBALS['sf_test_nonce'] = 'valid-nonce';

		$this->assertTrue( AdminMenu::actionNonceValid( 'valid-nonce' ) );
		$this->assertSame( 'valid-nonce', $GLOBALS['sf_test_last_verified_nonce']['nonce'] );
		$this->assertSame( 'subtleforms_action', $GLOBALS['sf_test_last_verified_nonce']['action'] );

		$this->assertTrue( AdminMenu::actionNonceValid( 'valid\\-nonce' ), 'wp_unslash before verify' );

		$this->assertFalse( AdminMenu::actionNonceValid( 'wrong' ) );
		$this->assertFalse( AdminMenu::actionNonceValid( '' ) );
		$this->assertFalse( AdminMenu::actionNonceValid( null ) );
		$this->assertFalse( AdminMenu::actionNonceValid( array( 'valid-nonce' ) ) );
		// strip_tags leaves the nonce text; a wrong token still fails.
		$this->assertFalse( AdminMenu::actionNonceValid( '<script>other-nonce</script>' ) );
	}

	public function test_public_routes_uri_parsing_keeps_valid_paths_and_rejects_malformed(): void {
		$GLOBALS['sf_test_rest_prefix'] = 'wp-json';

		$this->assertSame(
			'/subtleforms/v1/submit',
			PublicRoutes::routeFromUri( '/wp-json/subtleforms/v1/submit' )
		);
		$this->assertSame(
			'/subtleforms/v1/submit',
			PublicRoutes::routeFromUri( '/blog/wp-json/subtleforms/v1/submit?x=1' )
		);
		$this->assertSame(
			'/subtleforms/v1/forms/12/schema',
			PublicRoutes::routeFromUri( '/wp-json/subtleforms/v1/forms/12/schema' )
		);
		$this->assertTrue( PublicRoutes::isPublicRoute( PublicRoutes::routeFromUri( '/wp-json/subtleforms/v1/submit' ) ) );
		$this->assertTrue( PublicRoutes::isPublicRoute( PublicRoutes::routeFromUri( '/wp-json/subtleforms/v1/uploads' ) ) );

		// Encoded path segment still yields a parseable path under the REST prefix.
		$encoded = PublicRoutes::routeFromUri( '/wp-json/subtleforms/v1/submit%2Fextra' );
		$this->assertStringStartsWith( '/subtleforms/v1/', $encoded );

		$this->assertSame( '', PublicRoutes::routeFromUri( '' ) );
		$this->assertSame( '', PublicRoutes::routeFromUri( 'not a uri !!!' ) );
		$this->assertSame( '', PublicRoutes::routeFromUri( '/wp-admin/admin.php?page=subtleforms' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( PublicRoutes::routeFromUri( '/wp-json/subtleforms/v1/settings' ) ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( PublicRoutes::routeFromUri( " /wp-json/subtleforms/v1/submit\n/evil" ) ) );
	}

	public function test_admin_menu_uses_sanitize_before_verify_like_uploads(): void {
		$menu    = (string) file_get_contents( dirname( __DIR__, 2 ) . '/src/Admin/AdminMenu.php' );
		$uploads = (string) file_get_contents( dirname( __DIR__, 2 ) . '/src/Uploads/Uploads.php' );
		$this->assertStringContainsString( 'sanitize_text_field( wp_unslash( (string) $nonce ) )', $menu );
		$this->assertStringContainsString( 'actionNonceValid', $menu );
		$this->assertStringContainsString( 'sanitize_text_field( wp_unslash( $_GET[\'_wpnonce\'] ) )', $uploads );
	}

	public function test_every_nonce_is_sanitized_before_wp_verify_nonce(): void {
		$src = dirname( __DIR__, 2 ) . '/src';
		$it  = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $src ) );
		foreach ( $it as $file ) {
			if ( 'php' !== $file->getExtension() ) {
				continue;
			}
			$code = (string) file_get_contents( $file->getPathname() );
			$this->assertDoesNotMatchRegularExpression(
				'/\$nonce\s*=\s*\$request->get_(header|param)\(/',
				$code,
				$file->getPathname() . ' passes an unsanitized request nonce to wp_verify_nonce()'
			);
			$this->assertDoesNotMatchRegularExpression(
				'/wp_verify_nonce\(\s*(wp_unslash\()?\s*\$_(GET|POST|REQUEST|SERVER|COOKIE)/',
				$code,
				$file->getPathname() . ' verifies a raw superglobal nonce'
			);
		}
	}
}
