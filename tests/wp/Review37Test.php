<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Review findings on the 2.4.0 release PR (#37).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Api\ClassicResult;
use SubtleForms\Blocks\SubtleFormsBlock;

final class Review37Test extends TestCase {

	protected function tearDown(): void {
		unset( $_GET[ ClassicResult::QUERY ] );
		parent::tearDown();
	}

	public function test_a_classic_outcome_is_read_once_for_its_own_form(): void {
		$token = ClassicResult::store(
			ClassicResult::outcome( 422, array( 'error' => array( 'message' => 'Nope' ) ), 41, array( 'name' => 'Ada', 'h-captcha-response' => 'x' ) )
		);
		$this->assertStringContainsString( ClassicResult::QUERY . '=' . $token, ClassicResult::returnUrl( 'https://example.com/page/?' . ClassicResult::QUERY . '=old&a=1', $token ) );
		$this->assertStringNotContainsString( '=old', ClassicResult::returnUrl( 'https://example.com/page/?' . ClassicResult::QUERY . '=old&a=1', $token ) );

		$_GET[ ClassicResult::QUERY ] = $token;
		$this->assertNull( ClassicResult::forForm( 42 ), 'Another form on the page gets nothing.' );
		$read = ClassicResult::forForm( 41 );
		$this->assertFalse( $read['ok'] );
		$this->assertSame( 'Nope', $read['body']['error']['message'] );
		$this->assertSame( array( 'name' => 'Ada' ), $read['values'] );
		$this->assertFalse( get_transient( 'subtleforms_classic_' . $token ), 'The stored copy is removed once read.' );
		$this->assertNotNull( ClassicResult::forForm( 41 ), 'A second render in the same request still sees it.' );

		$_GET[ ClassicResult::QUERY ] = 'unknown' . $token;
		$this->assertNull( ClassicResult::forForm( 41 ) );
	}

	public function test_the_block_hands_the_outcome_to_the_renderer_only_without_ajax(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ) ) );
		$token  = ClassicResult::store(
			ClassicResult::outcome( 200, array( 'data' => array( 'success' => true, 'submission_id' => 5 ) ), $formId, array( 'name' => 'Ada' ) )
		);
		$_GET[ ClassicResult::QUERY ] = $token;

		$ajax = SubtleFormsBlock::render_block( array( 'formId' => $formId, 'ajax' => true ) );
		$this->assertStringNotContainsString( 'data-classic-result', $ajax );

		$html = SubtleFormsBlock::render_block( array( 'formId' => $formId, 'ajax' => false ) );
		$this->assertMatchesRegularExpression( '/data-classic-result="([^"]+)"/', $html );
		preg_match( '/data-classic-result="([^"]+)"/', $html, $m );
		$data = json_decode( html_entity_decode( $m[1], ENT_QUOTES ), true );
		$this->assertTrue( $data['ok'] );
		$this->assertSame( 5, $data['body']['data']['submission_id'] );
		$this->assertSame( array( 'name' => 'Ada' ), $data['values'] );
	}

	public function test_a_configured_external_confirmation_host_is_allowed_for_the_redirect(): void {
		$fallback = 'https://fallback.invalid/';
		$this->assertSame( $fallback, wp_validate_redirect( 'https://thanks.example.net/done', $fallback ), 'Off-site hosts are refused by default.' );
		$this->assertSame( '', ClassicResult::allowHostOf( 'javascript:alert(1)' ) );
		$this->assertSame( '', ClassicResult::allowHostOf( 'ftp://thanks.example.net/x' ) );
		$this->assertSame( 'thanks.example.net', ClassicResult::allowHostOf( 'https://Thanks.example.net/done?x=1' ) );
		$this->assertSame( 'https://thanks.example.net/done', wp_validate_redirect( 'https://thanks.example.net/done', $fallback ) );
		$this->assertSame( $fallback, wp_validate_redirect( 'https://other.example.net/', $fallback ), 'Only the configured host is added.' );
		remove_all_filters( 'allowed_redirect_hosts' );
	}

	public function test_the_entry_view_prices_answers_in_the_entry_s_own_currency(): void {
		global $wpdb;
		$product = array( 'id' => 'p1', 'key' => 'sticker', 'type' => 'payment_product', 'config' => array( 'label' => 'Sticker', 'productName' => 'Sticker', 'price' => 5000, 'allowQuantity' => true ) );
		$formId  = $this->publish( array( $product ) );
		$wpdb->insert(
			$wpdb->prefix . 'subtleforms_submissions',
			array(
				'form_id'    => $formId,
				'payload'    => wp_json_encode( array( 'sticker' => 2 ) ),
				'meta'       => wp_json_encode( array( 'order' => array( 'currency' => 'KRW', 'total' => 10000 ) ) ),
				'status'     => 'completed',
				'created_at' => current_time( 'mysql', true ),
			)
		);
		$id = (int) $wpdb->insert_id;
		wp_set_current_user( 1 );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions/' . $id );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$data = rest_do_request( $request )->get_data();
		$data = $data['data'] ?? $data;
		$this->assertStringContainsString( '10,000 KRW', (string) ( $data['display']['sticker']['text'] ?? '' ) );
	}

	public function test_reimporting_after_a_status_change_skips_the_entries_and_twins_stay_apart(): void {
		wp_set_current_user( 1 );
		$fields = array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ) );
		$from   = $this->publish( $fields );
		$to     = $this->publish( $fields );
		$subs   = new \SubtleForms\Repositories\SubmissionsRepository();
		// Two entries with the same answers at the same second.
		$a = $subs->create( array( 'form_id' => $from, 'payload' => array( 'name' => 'Ada' ), 'status' => 'completed' ) );
		$b = $subs->create( array( 'form_id' => $from, 'payload' => array( 'name' => 'Ada' ), 'status' => 'completed' ) );
		$subs->setCreatedAt( $a, '2026-10-18 12:00:00' );
		$subs->setCreatedAt( $b, '2026-10-18 12:00:00' );

		$service = new \SubtleForms\Tools\TransferService( new \SubtleForms\Repositories\FormsRepository(), $subs );
		$package = json_decode( wp_json_encode( $service->exportSubmissions( $from ) ), true );
		$this->assertSame( 2, $service->importSubmissions( $to, $package )['imported'], 'Twins with different source entries are both imported.' );

		$rows = $subs->findByForm( $to, array( 'orderby' => 'id', 'order' => 'ASC' ) );
		$subs->update( (int) $rows[0]['id'], array( 'status' => 'spam' ) );
		$subs->update( (int) $rows[1]['id'], array( 'is_read' => 1, 'starred' => 1 ) );

		$again = $service->importSubmissions( $to, $package );
		$this->assertSame( 0, $again['imported'] );
		$this->assertSame( 2, $again['skipped'] );

		$back = $service->importSubmissions( $from, $package );
		$this->assertSame( 0, $back['imported'], 'Entries imported back into their own form are recognised.' );
	}

	public function test_a_form_with_two_captchas_of_one_provider_verifies_the_token_once(): void {
		$formId = $this->publish(
			array(
				array( 'id' => 'name', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ),
				array( 'id' => 'c1', 'key' => 'c1', 'type' => 'recaptcha', 'config' => array( 'site_key' => 'site-a', 'secret_key' => 'secret-a' ) ),
				array( 'id' => 'c2', 'key' => 'c2', 'type' => 'recaptcha', 'config' => array( 'site_key' => 'site-b', 'secret_key' => 'secret-b' ) ),
			)
		);
		$calls = array();
		$mock  = static function ( $pre, $args, $url ) use ( &$calls ) {
			if ( false === strpos( (string) $url, 'siteverify' ) ) {
				return $pre;
			}
			$calls[] = $args['body'] ?? array();
			// A token is good once: the provider rejects a replay.
			$ok = count( $calls ) === 1;
			return array(
				'headers'  => array(),
				'body'     => wp_json_encode( array( 'success' => $ok, 'score' => 0.9, 'error-codes' => $ok ? array() : array( 'timeout-or-duplicate' ) ) ),
				'response' => array( 'code' => 200, 'message' => 'OK' ),
				'cookies'  => array(),
				'filename' => null,
			);
		};
		add_filter( 'pre_http_request', $mock, 10, 3 );
		$result = $this->submit( $formId, array( 'name' => 'Ada', 'g-recaptcha-response' => 'token-1' ) );
		remove_filter( 'pre_http_request', $mock, 10 );

		$this->assertCount( 1, $calls, 'The token is verified once.' );
		$this->assertSame( 'secret-a', $calls[0]['secret'] ?? '', 'With the first field\'s keys.' );
		$this->assertLessThan( 400, $result['status'], wp_json_encode( $result['data'] ) );
	}
}
