<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Per-form spam protection, new form defaults and the trap markup (2.6.0).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Analytics\SpamStats;
use SubtleForms\Engine\SpamProtection;

require_once __DIR__ . '/fixtures/spam-stubs.php';

final class SpamProtection260Test extends TestCase {

	protected function setUp(): void {
		$GLOBALS['sf_test_options'] = array();
	}

	protected function tearDown(): void {
		$GLOBALS['sf_test_options'] = array();
	}

	private function site( array $settings ): void {
		$GLOBALS['sf_test_options']['subtleforms_settings'] = $settings;
	}

	private function schema( ?array $spam ): array {
		$schema = array( 'metadata' => array( 'name' => 'x' ), 'fields' => array() );
		if ( null !== $spam ) {
			$schema['metadata']['spam'] = $spam;
		}
		return $schema;
	}

	public function test_a_form_without_its_own_choice_keeps_the_old_behaviour(): void {
		$this->site( array( 'enable_honeypot' => false, 'min_submission_time' => 0 ) );
		$p = SpamProtection::for_form( $this->schema( null ) );
		// The trap field was always checked before 2.6.0, whatever the site setting said.
		$this->assertTrue( $p['honeypot'] );
		$this->assertFalse( $p['timeTrap'] );
		$this->assertFalse( $p['own'] );

		$this->site( array( 'min_submission_time' => 5 ) );
		$p = SpamProtection::for_form( null );
		$this->assertTrue( $p['timeTrap'] );
		$this->assertSame( 5, $p['minSeconds'] );
	}

	public function test_a_form_choice_wins(): void {
		$this->site( array( 'min_submission_time' => 0 ) );
		$p = SpamProtection::for_form( $this->schema( array( 'honeypot' => false, 'timeTrap' => true ) ) );
		$this->assertFalse( $p['honeypot'] );
		$this->assertTrue( $p['timeTrap'] );
		$this->assertSame( SpamProtection::MIN_SUBMISSION_TIME, $p['minSeconds'], 'on means on, with the usual minimum' );
		$this->assertTrue( $p['own'] );
	}

	public function test_new_forms_start_with_both_traps_on_with_the_default_settings(): void {
		$schema = SpamProtection::with_new_form_defaults( $this->schema( null ) );
		$this->assertSame( array( 'honeypot' => true, 'timeTrap' => true ), $schema['metadata']['spam'] );
	}

	public function test_new_forms_follow_the_site_defaults_and_keep_their_own_choice(): void {
		$this->site( array( 'enable_honeypot' => false, 'min_submission_time' => 0 ) );
		$this->assertSame( array( 'honeypot' => false, 'timeTrap' => false ), SpamProtection::with_new_form_defaults( array() )['metadata']['spam'] );

		$this->site( array() );
		$kept = SpamProtection::with_new_form_defaults( $this->schema( array( 'timeTrap' => false ) ) );
		$this->assertSame( array( 'timeTrap' => false, 'honeypot' => true ), $kept['metadata']['spam'] );
	}

	public function test_block_reasons(): void {
		$on  = array( 'honeypot' => true, 'timeTrap' => true, 'minSeconds' => 3 );
		$now = 1800000000;
		$ok  = SpamProtection::issue_token( 7, $now - 10 );

		$this->assertNull( SpamProtection::block_reason( array( 'form_rendered_at' => $ok ), 7, $on, false, $now ) );
		$this->assertSame( 'honeypot_filled', SpamProtection::block_reason( array( 'website_url' => 'x', 'form_rendered_at' => $ok ), 7, $on, false, $now ) );
		$this->assertSame( 'submission_too_fast', SpamProtection::block_reason( array( 'form_rendered_at' => SpamProtection::issue_token( 7, $now - 1 ) ), 7, $on, false, $now ) );
		$this->assertSame( 'time_token_missing', SpamProtection::block_reason( array(), 7, $on, false, $now ) );
		$this->assertSame( 'time_token_missing', SpamProtection::block_reason( array( 'form_rendered_at' => SpamProtection::issue_token( 8, $now - 10 ) ), 7, $on, false, $now ), 'a token for another form' );
		$this->assertNull( SpamProtection::block_reason( array(), 7, $on, true, $now ), 'an admin test skips the time trap' );
		$this->assertNull( SpamProtection::block_reason( array( 'website_url' => 'x' ), 7, array( 'honeypot' => false, 'timeTrap' => false ), false, $now ) );
	}

	public function test_a_token_from_a_cached_page_is_never_too_old(): void {
		$on  = array( 'honeypot' => true, 'timeTrap' => true, 'minSeconds' => 3 );
		$now = 1800000000;
		$old = SpamProtection::issue_token( 7, $now - 30 * 86400 );
		$this->assertNull( SpamProtection::block_reason( array( 'form_rendered_at' => $old ), 7, $on, false, $now ) );
	}

	public function test_the_trap_markup_is_hidden_from_screen_readers_keyboards_and_autofill(): void {
		$html = SpamProtection::get_honeypot_html( 3 );
		$this->assertMatchesRegularExpression( '/<div class="subtleforms-hp"[^>]*aria-hidden="true"/', $html );
		$this->assertMatchesRegularExpression( '/<input type="text"[^>]*tabindex="-1"/', $html );
		$this->assertMatchesRegularExpression( '/<input type="text"[^>]*aria-hidden="true"/', $html );
		$this->assertMatchesRegularExpression( '/<input type="text"[^>]*autocomplete="off"/', $html );
		$this->assertMatchesRegularExpression( '/<input type="text"[^>]*data-1p-ignore/', $html );
	}

	public function test_the_live_form_trap_is_hidden_from_screen_readers_keyboards_and_autofill(): void {
		$jsx = file_get_contents( dirname( __DIR__, 2 ) . '/resources/frontend/components/FormRenderer.jsx' );
		$this->assertMatchesRegularExpression( "/<div className='subtleforms-honeypot' aria-hidden='true'>/", $jsx );
		$start = strpos( $jsx, "data-subtleforms-honeypot='1'" );
		$input = substr( $jsx, $start - 120, 420 );
		$this->assertStringContainsString( 'tabIndex={-1}', $input );
		$this->assertStringContainsString( "autoComplete='off'", $input );
		$this->assertStringContainsString( "aria-hidden='true'", $input );
		// A random name, so autofill does not recognise "website".
		$this->assertStringContainsString( 'name={honeypotName}', $input );
	}

	public function test_reasons_are_normalised_to_the_counted_list(): void {
		$this->assertSame( 'honeypot', SpamStats::normalizeReason( 'honeypot_filled' ) );
		$this->assertSame( 'time_trap', SpamStats::normalizeReason( 'submission_too_fast' ) );
		$this->assertSame( 'time_trap', SpamStats::normalizeReason( 'time_token_missing' ) );
		$this->assertSame( 'captcha_failed', SpamStats::normalizeReason( 'captcha_failed' ) );
		$this->assertSame( 'other', SpamStats::normalizeReason( 'akismet' ) );
	}
}
