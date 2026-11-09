<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * The Security & privacy notice for a site behind Cloudflare (issue 86), and
 * the rate limit key of two visitors who share a Cloudflare address.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Security\ClientIp;

final class CloudflareNotice281Test extends TestCase {

	private $server;
	private $settings;

	protected function setUp(): void {
		parent::setUp();
		$this->server   = $_SERVER;
		$this->settings = get_option( 'subtleforms_settings', false );
		$_SERVER['REMOTE_ADDR']           = '172.68.10.10';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$this->asAdmin();
		delete_user_meta( get_current_user_id(), AdminMenu::CLOUDFLARE_NOTICE_META );
	}

	protected function tearDown(): void {
		$_SERVER = $this->server;
		if ( false === $this->settings ) {
			delete_option( 'subtleforms_settings' );
		} else {
			update_option( 'subtleforms_settings', $this->settings );
		}
		delete_user_meta( get_current_user_id(), AdminMenu::CLOUDFLARE_NOTICE_META );
		parent::tearDown();
	}

	private function setTrust( bool $on ): void {
		$settings = get_option( 'subtleforms_settings', array() );
		$settings = is_array( $settings ) ? $settings : array();
		$settings['trust_cloudflare'] = $on;
		update_option( 'subtleforms_settings', $settings );
	}

	public function test_the_notice_shows_when_cloudflare_is_detected_and_the_setting_is_off(): void {
		$this->setTrust( false );
		$this->assertTrue( AdminMenu::cloudflare_notice() );
	}

	public function test_the_notice_is_absent_with_the_setting_on_or_without_cloudflare(): void {
		$this->setTrust( true );
		$this->assertFalse( AdminMenu::cloudflare_notice(), 'setting on' );

		$this->setTrust( false );
		$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
		$this->assertFalse( AdminMenu::cloudflare_notice(), 'a visitor who is not Cloudflare' );

		$_SERVER['REMOTE_ADDR'] = '172.68.10.10';
		unset( $_SERVER['HTTP_CF_CONNECTING_IP'] );
		$this->assertFalse( AdminMenu::cloudflare_notice(), 'no header' );
	}

	public function test_dismissing_it_is_remembered_for_the_user(): void {
		$this->setTrust( false );
		$this->assertTrue( AdminMenu::cloudflare_notice() );

		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/cloudflare-notice/dismiss' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status() );
		$this->assertFalse( AdminMenu::cloudflare_notice() );

		$other = self::factory_user( 'administrator' );
		wp_set_current_user( $other );
		$this->assertTrue( AdminMenu::cloudflare_notice(), 'another user still sees it' );
		wp_delete_user( $other );
	}

	public function test_a_visitor_cannot_dismiss_it(): void {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/cloudflare-notice/dismiss' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$response = rest_do_request( $request );
		$this->assertContains( $response->get_status(), array( 401, 403 ) );
	}

	public function test_visitors_behind_one_cloudflare_address_get_their_own_rate_limit_key(): void {
		$_SERVER['REMOTE_ADDR']           = '172.68.10.10';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.31';
		$first                            = ClientIp::get();
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.32';
		$second                           = ClientIp::get();
		$this->assertSame( '198.51.100.31', $first );
		$this->assertSame( '198.51.100.32', $second );
	}
}
