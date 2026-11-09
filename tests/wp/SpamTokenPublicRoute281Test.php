<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * A logged-in visitor whose REST nonce has expired must still be able to
 * trade the page ticket for a submit token (issue 83). Without it the
 * time-trap form answered 409 on every try.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Engine\SpamProtection;
use SubtleForms\Security\PublicRoutes;

final class SpamTokenPublicRoute281Test extends TestCase {

	protected function tearDown(): void {
		global $wp;
		unset( $wp->query_vars['rest_route'] );
		parent::tearDown();
	}

	public function test_the_token_exchange_is_a_public_route(): void {
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/1/spam-token' ) );
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/12/spam-token/' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/1/spam-tokens' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/x/spam-token' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/1' ) );
	}

	public function test_a_bad_nonce_on_the_exchange_is_served_as_a_visitor(): void {
		global $wp;
		$wp->query_vars['rest_route'] = '/subtleforms/v1/forms/1/spam-token';
		$error                        = new \WP_Error( 'rest_cookie_invalid_nonce', 'Cookie check failed', array( 'status' => 403 ) );
		$this->assertTrue( apply_filters( 'rest_authentication_errors', $error ) );
		$this->assertSame( 0, get_current_user_id(), 'treated as a visitor' );

		$wp->query_vars['rest_route'] = '/subtleforms/v1/forms/1';
		$this->assertInstanceOf( \WP_Error::class, PublicRoutes::allowStaleNonce( $error ), 'other routes still refuse a bad nonce' );
	}

	public function test_the_exchange_then_answers_with_a_submit_token(): void {
		$id     = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$ticket = SpamProtection::issue_ticket( $id, time() - 60 );

		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $id . '/spam-token' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'token' => $ticket ) ) );
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertNotSame( '', $response->get_data()['data']['spam_token'] ?? '' );
	}
}
