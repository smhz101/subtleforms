<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * WPORG-P0-B: POST /onboarding/send-test-email is administrator-only.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

final class OnboardingSendTestEmailAuthTest extends TestCase {

	/** @var int[] */
	private $userIds = array();

	/** @var array<int, array> */
	private $mailSent = array();

	protected function tearDown(): void {
		foreach ( $this->userIds as $id ) {
			wp_delete_user( $id );
		}
		$this->userIds = array();
		$this->mailSent = array();
		remove_all_filters( 'pre_wp_mail' );
		parent::tearDown();
	}

	private function makeUser( string $role ): int {
		$name = 'sf_p0b_' . $role . '_' . wp_generate_password( 6, false );
		$id   = (int) wp_insert_user(
			array(
				'user_login' => $name,
				'user_pass'  => wp_generate_password(),
				'user_email' => $name . '@example.com',
				'role'       => $role,
			)
		);
		$this->userIds[] = $id;
		return $id;
	}

	private function startMailSpy(): void {
		$this->mailSent = array();
		add_filter(
			'pre_wp_mail',
			function ( $null, $atts ) {
				$this->mailSent[] = $atts;
				return true;
			},
			10,
			2
		);
	}

	private function sendTestEmailRequest( ?string $nonce ): \WP_REST_Response {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/onboarding/send-test-email' );
		if ( null !== $nonce ) {
			$request->set_header( 'X-WP-Nonce', $nonce );
		}
		return rest_do_request( $request );
	}

	public function test_administrator_with_nonce_can_send_test_email(): void {
		$admin = $this->makeUser( 'administrator' );
		wp_set_current_user( $admin );
		$this->startMailSpy();
		$response = $this->sendTestEmailRequest( wp_create_nonce( 'wp_rest' ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertNotEmpty( $this->mailSent, 'admin request may dispatch mail' );
		$to = $this->mailSent[0]['to'] ?? '';
		if ( is_array( $to ) ) {
			$to = $to[0] ?? '';
		}
		$this->assertSame( ( new \SubtleForms\Support\Settings() )->getAdminEmail(), $to );
	}

	/**
	 * @dataProvider non_admin_roles
	 */
	public function test_non_admin_roles_cannot_send_test_email( string $role ): void {
		$user = $this->makeUser( $role );
		wp_set_current_user( $user );
		$this->startMailSpy();
		$response = $this->sendTestEmailRequest( wp_create_nonce( 'wp_rest' ) );
		$this->assertContains( $response->get_status(), array( 401, 403 ), $role );
		$this->assertSame( array(), $this->mailSent, $role . ' must not dispatch mail' );
	}

	public function non_admin_roles(): array {
		return array(
			'editor'      => array( 'editor' ),
			'author'      => array( 'author' ),
			'contributor' => array( 'contributor' ),
			'subscriber'  => array( 'subscriber' ),
		);
	}

	public function test_unauthenticated_cannot_send_test_email(): void {
		wp_set_current_user( 0 );
		$this->startMailSpy();
		$response = $this->sendTestEmailRequest( null );
		$this->assertContains( $response->get_status(), array( 401, 403 ) );
		$this->assertSame( array(), $this->mailSent );
	}

	public function test_admin_without_valid_nonce_is_denied_and_sends_no_mail(): void {
		$admin = $this->makeUser( 'administrator' );
		wp_set_current_user( $admin );
		$this->startMailSpy();

		$missing = $this->sendTestEmailRequest( null );
		$this->assertContains( $missing->get_status(), array( 401, 403 ) );

		$bad = $this->sendTestEmailRequest( 'not-a-valid-nonce' );
		$this->assertContains( $bad->get_status(), array( 401, 403 ) );

		$this->assertSame( array(), $this->mailSent );
	}

	public function test_only_admins_can_dismiss_more_features(): void {
		$editor = $this->makeUser( 'editor' );
		wp_set_current_user( $editor );
		delete_user_meta( $editor, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/more-features/dismiss' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$this->assertContains( rest_do_request( $request )->get_status(), array( 401, 403 ) );
		$this->assertEmpty( get_user_meta( $editor, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META, true ) );

		$admin = $this->makeUser( 'administrator' );
		wp_set_current_user( $admin );
		delete_user_meta( $admin, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/more-features/dismiss' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$this->assertSame( 200, rest_do_request( $request )->get_status() );
		$this->assertNotEmpty( get_user_meta( $admin, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META, true ) );
		delete_user_meta( $admin, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META );
	}
}
