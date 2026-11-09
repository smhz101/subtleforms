<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Behind Cloudflare the visitor address is read from Cloudflare's header
 * without a setting, but only for a connection that comes from Cloudflare
 * (issue 86).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Security\ClientIp;

require_once __DIR__ . '/fixtures/security-stubs.php';

final class CloudflareClientIp281Test extends TestCase {

	protected function setUp(): void {
		$GLOBALS['sf_test_options'] = array();
		$GLOBALS['sf_test_filters'] = array();
		$_SERVER                    = array();
	}

	protected function tearDown(): void {
		$GLOBALS['sf_test_options'] = array();
		$GLOBALS['sf_test_filters'] = array();
		$_SERVER                    = array();
	}

	/**
	 * @dataProvider cloudflareAddresses
	 */
	public function test_an_address_inside_the_published_ranges_is_cloudflare( string $ip, bool $inside ): void {
		$this->assertSame( $inside, ClientIp::in_ranges( $ip, ClientIp::CLOUDFLARE_RANGES ), $ip );
	}

	public static function cloudflareAddresses(): array {
		return array(
			'ipv4 first of 104.16.0.0/13'    => array( '104.16.0.1', true ),
			'ipv4 last of 104.16.0.0/13'     => array( '104.23.255.254', true ),
			'ipv4 just before 104.16'        => array( '104.15.255.255', false ),
			'ipv4 just after 104.16.0.0/13'  => array( '104.24.0.1', true ),
			'ipv4 172.64.0.0/13 last'        => array( '172.71.255.255', true ),
			'ipv4 after 172.64.0.0/13'       => array( '172.72.0.0', false ),
			'ipv4 162.158.0.0/15'            => array( '162.159.1.1', true ),
			'ipv4 outside 162.158/15'        => array( '162.160.0.1', false ),
			'ipv4 small range'               => array( '131.0.75.255', true ),
			'ipv4 past the small range'      => array( '131.0.76.0', false ),
			'ipv4 documentation address'     => array( '203.0.113.9', false ),
			'ipv4 private address'           => array( '10.0.0.1', false ),
			'ipv6 2606:4700::/32'            => array( '2606:4700:10::6814:1', true ),
			'ipv6 next /32'                  => array( '2606:4701::1', false ),
			'ipv6 2400:cb00::/32'            => array( '2400:cb00:2049::1', true ),
			'ipv6 2a06:98c0::/29 first'      => array( '2a06:98c0::1', true ),
			'ipv6 2a06:98c0::/29 last'       => array( '2a06:98c7:ffff::1', true ),
			'ipv6 past 2a06:98c0::/29'       => array( '2a06:98c8::1', false ),
			'ipv6 2c0f:f248::/32'            => array( '2c0f:f248:1::1', true ),
			'ipv6 documentation address'     => array( '2001:db8::1', false ),
			'ipv4 as ipv6 inside'            => array( '::ffff:104.16.0.5', true ),
			'ipv4 as ipv6 outside'           => array( '::ffff:203.0.113.9', false ),
		);
	}

	public function test_every_published_range_is_a_valid_range(): void {
		$this->assertCount( 22, ClientIp::CLOUDFLARE_RANGES );
		foreach ( ClientIp::CLOUDFLARE_RANGES as $range ) {
			$this->assertTrue( ClientIp::valid_range( $range ), $range );
		}
	}

	public function test_a_connection_from_cloudflare_with_the_header_is_detected(): void {
		$_SERVER['REMOTE_ADDR']           = '104.16.0.5';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$this->assertTrue( ClientIp::cloudflare_detected() );
		$this->assertSame( '198.51.100.20', ClientIp::cloudflare_visitor() );

		$_SERVER['REMOTE_ADDR']           = '2606:4700::5';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '2001:db8::7';
		$this->assertTrue( ClientIp::cloudflare_detected(), 'over IPv6' );
		$this->assertSame( '2001:db8::7', ClientIp::cloudflare_visitor() );
	}

	public function test_nothing_is_detected_without_cloudflare(): void {
		$_SERVER['REMOTE_ADDR']           = '203.0.113.9';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$this->assertFalse( ClientIp::cloudflare_detected(), 'the header from a visitor who is not Cloudflare' );

		$_SERVER['REMOTE_ADDR'] = '104.16.0.5';
		unset( $_SERVER['HTTP_CF_CONNECTING_IP'] );
		$this->assertFalse( ClientIp::cloudflare_detected(), 'Cloudflare without the header' );

		$_SERVER['HTTP_CF_CONNECTING_IP'] = 'not-an-ip';
		$this->assertFalse( ClientIp::cloudflare_detected(), 'a header that is not an address' );

		$_SERVER = array();
		$this->assertFalse( ClientIp::cloudflare_detected(), 'no connection data' );
	}

	public function test_the_header_is_trusted_without_the_setting_for_a_cloudflare_connection(): void {
		$_SERVER['REMOTE_ADDR']           = '172.68.10.10';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$this->assertSame( '198.51.100.20', ClientIp::get() );

		// Two visitors, two addresses: the rate limit keys differ.
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.21';
		$this->assertSame( '198.51.100.21', ClientIp::get() );
	}

	public function test_a_spoofed_header_from_another_sender_is_not_believed(): void {
		$_SERVER['REMOTE_ADDR']           = '203.0.113.9';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$this->assertSame( '203.0.113.9', ClientIp::get() );

		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'trust_cloudflare' => true );
		$this->assertSame( '203.0.113.9', ClientIp::get(), 'not even with the setting on' );
	}

	public function test_a_cloudflare_connection_without_the_header_keeps_its_own_address(): void {
		$_SERVER['REMOTE_ADDR'] = '104.16.0.5';
		$this->assertSame( '104.16.0.5', ClientIp::get() );
	}

	public function test_the_filter_turns_the_automatic_use_off_and_the_setting_turns_it_back_on(): void {
		$_SERVER['REMOTE_ADDR']           = '104.16.0.5';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$GLOBALS['sf_test_filters']['subtleforms/client_ip/auto_cloudflare'] = static function () {
			return false;
		};
		$this->assertSame( '104.16.0.5', ClientIp::get() );

		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'trust_cloudflare' => true );
		$this->assertSame( '198.51.100.20', ClientIp::get(), 'the explicit setting still works' );
	}
}
