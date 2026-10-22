<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * The install routine tells a new install from an update (2.6.0): a new
 * install stores spam protection on, an update changes no setting and only
 * queues the one-time dashboard offer.
 *
 * Runs in its own process: it defines WordPress stubs that other unit
 * tests do not expect.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class ActivatorSpamDefaults260Test extends TestCase {

	protected function setUp(): void {
		require_once __DIR__ . '/fixtures/activator-stubs.php';
		$GLOBALS['sf_test_scheduled'] = array();
		$GLOBALS['sf_test_dbdelta']   = array();
		$GLOBALS['wpdb']              = new \SF_Activator_Wpdb();
		$GLOBALS['wp_version']        = '6.8';
	}

	public function test_a_new_install_turns_spam_protection_on(): void {
		$GLOBALS['sf_test_options'] = array();

		\SubtleForms\Activator::activate();

		$settings = $GLOBALS['sf_test_options']['subtleforms_settings'];
		$this->assertTrue( $settings['enable_honeypot'] );
		$this->assertSame( 3, $settings['min_submission_time'] );
		$this->assertSame( 'none', $GLOBALS['sf_test_options']['subtleforms_spam_notice'] );
	}

	public function test_an_update_changes_no_setting_and_queues_the_offer(): void {
		$before                     = array( 'enable_honeypot' => false, 'min_submission_time' => 0 );
		$GLOBALS['sf_test_options'] = array(
			'subtleforms_db_version' => '2.5.0',
			'subtleforms_settings'   => $before,
		);

		$this->assertTrue( \SubtleForms\Activator::maybe_upgrade( '2.6.0' ) );

		$this->assertSame( $before, $GLOBALS['sf_test_options']['subtleforms_settings'] );
		$this->assertSame( 'pending', $GLOBALS['sf_test_options']['subtleforms_spam_notice'] );
	}

	public function test_a_later_update_keeps_the_answer(): void {
		$GLOBALS['sf_test_options'] = array(
			'subtleforms_db_version'  => '2.6.0',
			'subtleforms_settings'    => array(),
			'subtleforms_spam_notice' => 'dismissed',
		);

		\SubtleForms\Activator::maybe_upgrade( '2.6.1' );

		$this->assertSame( 'dismissed', $GLOBALS['sf_test_options']['subtleforms_spam_notice'] );
	}
}
