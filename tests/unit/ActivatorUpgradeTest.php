<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * An update runs the activation steps when the stored version is not this
 * build's version, and those steps schedule the FF-30 entry schema
 * clean-up (review of PR #27). The version number itself is raised to
 * 2.4.0 in the release commit.
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
final class ActivatorUpgradeTest extends TestCase {

	protected function setUp(): void {
		require_once __DIR__ . '/fixtures/activator-stubs.php';
		$GLOBALS['sf_test_options']   = array( 'subtleforms_db_version' => '2.3.9' );
		$GLOBALS['sf_test_scheduled'] = array();
		$GLOBALS['sf_test_dbdelta']   = array();
		$GLOBALS['wpdb']              = new \SF_Activator_Wpdb();
		$GLOBALS['wp_version']        = '6.8';
	}

	public function test_a_changed_version_runs_activation_and_schedules_the_entry_schema_migration(): void {
		$this->assertTrue( \SubtleForms\Activator::maybe_upgrade( '2.4.0' ) );

		$this->assertNotEmpty( $GLOBALS['sf_test_dbdelta'], 'tables are checked' );
		$hooks = array_column( $GLOBALS['sf_test_scheduled'], 'hook' );
		$this->assertContains( \SubtleForms\Tools\EntrySchemaMigration::HOOK, $hooks );
		$this->assertSame( '0', $GLOBALS['sf_test_options'][ \SubtleForms\Tools\EntrySchemaMigration::OPTION ] );
		$this->assertSame( '2.4.0', $GLOBALS['sf_test_options']['subtleforms_db_version'] );
		$this->assertSame( '2.4.0', $GLOBALS['sf_test_options']['subtleforms_version'] );
	}

	public function test_the_same_version_does_nothing(): void {
		$this->assertFalse( \SubtleForms\Activator::maybe_upgrade( '2.3.9' ) );
		$this->assertSame( array(), $GLOBALS['sf_test_dbdelta'] );
		$this->assertSame( array(), $GLOBALS['sf_test_scheduled'] );
	}

	public function test_the_plugin_file_uses_the_version_check(): void {
		$main = file_get_contents( dirname( __DIR__, 2 ) . '/subtleforms.php' );
		$this->assertStringContainsString( 'SubtleForms\Activator::maybe_upgrade();', $main );
	}
}
