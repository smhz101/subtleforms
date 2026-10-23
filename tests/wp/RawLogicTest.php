<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Conditional logic reads the answers as typed, before websites are given
 * https:// (review of PR #28). The browser evaluates the typed value, so
 * a rule for "example.com" must match on the server too.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RawLogicTest extends TestCase {

	/** @var array[] */
	private $emails = array();

	protected function setUp(): void {
		parent::setUp();
		$this->emails = array();
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
			$this->emails[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	private static function whenSite( string $value ): array {
		return array(
			'action' => 'show',
			'groups' => array(
				array(
					'match' => 'all',
					'rules' => array( array( 'field' => 'site', 'operator' => 'equals', 'value' => $value ) ),
				),
			),
		);
	}

	public function test_rules_match_the_website_as_typed_for_storage_order_pricing_and_actions(): void {
		$id = $this->publish(
			array(
				array( 'type' => 'url', 'key' => 'site', 'label' => 'Website' ),
				array( 'type' => 'text', 'key' => 'company', 'label' => 'Company', 'logic' => self::whenSite( 'example.com' ) ),
			),
			array(
				array( 'id' => 'save', 'type' => 'save', 'enabled' => true ),
				array(
					'id'      => 'notify',
					'type'    => 'email',
					'enabled' => true,
					'logic'   => self::whenSite( 'example.com' ),
					'config'  => array( 'to' => 'owner@example.org', 'subject' => 'Audit', 'message' => '{all_fields}' ),
				),
			)
		);

		// Pricing is done by a payment add-on; it is handed the answers as typed.
		$typed = null;
		$spy   = static function ( $order, $formId, $schema, $payload, $request, $logicValues ) use ( &$typed ) {
			$typed = $logicValues;
			return $order;
		};
		add_filter( 'subtleforms/submit/price_order', $spy, 10, 6 );

		$res = $this->submit( $id, array( 'site' => 'example.com', 'company' => 'Acme' ) );
		remove_filter( 'subtleforms/submit/price_order', $spy, 10 );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );

		$stored = $this->storedPayload( $id );
		// The website is still stored with https://.
		$this->assertSame( 'https://example.com', $stored['site'] );
		// The field the visitor saw is kept.
		$this->assertSame( 'Acme', $stored['company'] ?? null );

		$row = $this->storedRow( $id );
		// The order pricing sees the website as typed.
		$this->assertSame( 'example.com', $typed['site'] ?? null );
		// The answers as typed are not stored in the entry meta.
		$this->assertStringNotContainsString( 'logic_payload', $row );

		// The email that is only sent for example.com is sent.
		$this->assertCount( 1, $this->emails );
	}
}
