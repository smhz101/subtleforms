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
}
