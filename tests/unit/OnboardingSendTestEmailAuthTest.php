<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * WPORG-P0-B: send-test-email needs manage_options; every other onboarding route needs manage_options too.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace {
	if ( ! class_exists( 'WP_Error' ) ) {
		class WP_Error {
			public $code;
			public $message;
			public $data;
			public function __construct( $code = '', $message = '', $data = '' ) {
				$this->code    = $code;
				$this->message = $message;
				$this->data    = $data;
			}
			public function get_error_code() {
				return $this->code;
			}
		}
	}

	if ( ! class_exists( 'WP_REST_Request' ) ) {
		class WP_REST_Request {
			private $headers = array();
			public function set_header( $key, $value ) {
				$this->headers[ strtolower( (string) $key ) ] = $value;
			}
			public function get_header( $key ) {
				$k = strtolower( (string) $key );
				return $this->headers[ $k ] ?? null;
			}
		}
	}

	if ( ! function_exists( 'is_user_logged_in' ) ) {
		function is_user_logged_in() {
			return ! empty( $GLOBALS['sf_test_logged_in'] );
		}
	}

	if ( ! function_exists( 'current_user_can' ) ) {
		function current_user_can( $cap ) {
			$caps = $GLOBALS['sf_test_caps'] ?? array();
			return ! empty( $caps[ $cap ] );
		}
	}

	if ( ! function_exists( 'wp_verify_nonce' ) ) {
		function wp_verify_nonce( $nonce, $action ) {
			return ! empty( $GLOBALS['sf_test_nonce_ok'] ) && 'wp_rest' === $action && 'good-nonce' === $nonce;
		}
	}
}

namespace SubtleForms\Tests\Unit {

	use PHPUnit\Framework\TestCase;
	use SubtleForms\Api\OnboardingApi;

	final class OnboardingSendTestEmailAuthTest extends TestCase {

		private string $root;

		protected function setUp(): void {
			$this->root                    = dirname( __DIR__, 2 );
			$GLOBALS['sf_test_logged_in']  = false;
			$GLOBALS['sf_test_caps']       = array();
			$GLOBALS['sf_test_nonce_ok']   = false;
		}

		protected function tearDown(): void {
			$GLOBALS['sf_test_logged_in'] = false;
			$GLOBALS['sf_test_caps']      = array();
			$GLOBALS['sf_test_nonce_ok']  = false;
		}

		private function apiSource(): string {
			return (string) file_get_contents( $this->root . '/src/Api/OnboardingApi.php' );
		}

		public function test_send_test_email_uses_a_dedicated_manage_options_callback(): void {
			$api = $this->apiSource();
			$this->assertMatchesRegularExpression(
				"/'\\/onboarding\\/send-test-email',[\\s\\S]*?'permission_callback'\\s*=>\\s*array\\(\\s*\\\$this,\\s*'check_send_test_email_permission'\\s*\\)/",
				$api
			);
			$this->assertStringContainsString( "current_user_can( 'manage_options' )", $api );
			$this->assertStringContainsString( 'function check_send_test_email_permission', $api );
		}

		public function test_other_onboarding_write_routes_use_the_admin_write_gate(): void {
			$api = $this->apiSource();
			foreach ( array( '/onboarding/dismiss', '/create-wizard/dismiss', '/more-features/dismiss', '/tour/complete' ) as $route ) {
				$this->assertMatchesRegularExpression(
					'/' . preg_quote( "'" . $route . "'", '/' ) . ",\\s*array\\([\\s\\S]*?'permission_callback'\\s*=>\\s*array\\(\\s*\\\$this,\\s*'check_write_permission'\\s*\\)/",
					$api,
					$route
				);
			}
			$this->assertMatchesRegularExpression(
				"/function check_write_permission\\([\\s\\S]*?current_user_can\\(\\s*'manage_options'\\s*\\)/",
				$api
			);
		}

		public function test_send_test_email_recipient_stays_admin_email_from_settings(): void {
			$api = $this->apiSource();
			$this->assertStringContainsString( 'getAdminEmail()', $api );
			$this->assertDoesNotMatchRegularExpression(
				"/function send_test_email[\\s\\S]*?get_param\\(\\s*'[^']*email/i",
				$api
			);
		}

		public function test_administrator_with_nonce_is_allowed(): void {
			$GLOBALS['sf_test_logged_in'] = true;
			$GLOBALS['sf_test_caps']      = array( 'manage_options' => true, 'edit_posts' => true );
			$GLOBALS['sf_test_nonce_ok']  = true;
			$request = new \WP_REST_Request();
			$request->set_header( 'X-WP-Nonce', 'good-nonce' );
			$this->assertTrue( ( new OnboardingApi() )->check_send_test_email_permission( $request ) );
		}

		/**
		 * @dataProvider non_admin_roles
		 */
		public function test_non_admins_are_forbidden( array $caps ): void {
			$GLOBALS['sf_test_logged_in'] = true;
			$GLOBALS['sf_test_caps']      = $caps;
			$GLOBALS['sf_test_nonce_ok']  = true;
			$request = new \WP_REST_Request();
			$request->set_header( 'X-WP-Nonce', 'good-nonce' );
			$result = ( new OnboardingApi() )->check_send_test_email_permission( $request );
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'subtleforms_forbidden', $result->get_error_code() );
		}

		public function non_admin_roles(): array {
			return array(
				'editor'      => array( array( 'edit_posts' => true, 'edit_others_posts' => true, 'publish_posts' => true ) ),
				'author'      => array( array( 'edit_posts' => true, 'publish_posts' => true ) ),
				'contributor' => array( array( 'edit_posts' => true ) ),
				'subscriber'  => array( array( 'read' => true ) ),
			);
		}

		public function test_unauthenticated_is_forbidden(): void {
			$GLOBALS['sf_test_logged_in'] = false;
			$GLOBALS['sf_test_caps']      = array();
			$GLOBALS['sf_test_nonce_ok']  = true;
			$request = new \WP_REST_Request();
			$request->set_header( 'X-WP-Nonce', 'good-nonce' );
			$result = ( new OnboardingApi() )->check_send_test_email_permission( $request );
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'subtleforms_forbidden', $result->get_error_code() );
		}

		public function test_missing_or_invalid_nonce_is_denied_for_admin(): void {
			$GLOBALS['sf_test_logged_in'] = true;
			$GLOBALS['sf_test_caps']      = array( 'manage_options' => true );
			$GLOBALS['sf_test_nonce_ok']  = true;
			$api = new OnboardingApi();

			$missing = new \WP_REST_Request();
			$missing_result = $api->check_send_test_email_permission( $missing );
			$this->assertInstanceOf( \WP_Error::class, $missing_result );
			$this->assertSame( 'subtleforms_invalid_nonce', $missing_result->get_error_code() );

			$bad = new \WP_REST_Request();
			$bad->set_header( 'X-WP-Nonce', 'bad-nonce' );
			$bad_result = $api->check_send_test_email_permission( $bad );
			$this->assertInstanceOf( \WP_Error::class, $bad_result );
			$this->assertSame( 'subtleforms_invalid_nonce', $bad_result->get_error_code() );
		}

		public function test_shared_write_gate_refuses_editors_and_allows_admins(): void {
			$GLOBALS['sf_test_logged_in'] = true;
			$GLOBALS['sf_test_nonce_ok']  = true;
			$request = new \WP_REST_Request();
			$request->set_header( 'X-WP-Nonce', 'good-nonce' );
			$GLOBALS['sf_test_caps'] = array( 'edit_posts' => true );
			$this->assertInstanceOf( \WP_Error::class, ( new OnboardingApi() )->check_write_permission( $request ) );
			$GLOBALS['sf_test_caps'] = array( 'manage_options' => true );
			$this->assertTrue( ( new OnboardingApi() )->check_write_permission( $request ) );
		}
	}
}
