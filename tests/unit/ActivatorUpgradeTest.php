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

	public function test_the_automatic_check_does_nothing_on_a_front_end_request(): void {
		$this->assertFalse( \SubtleForms\Activator::maybe_upgrade() );
		$this->assertSame( array(), $GLOBALS['sf_test_dbdelta'] );
		$this->assertSame( '2.3.9', $GLOBALS['sf_test_options']['subtleforms_db_version'] );
	}

	public function test_a_held_lock_stops_a_second_upgrade_and_an_old_one_is_taken_over(): void {
		$GLOBALS['sf_test_options']['subtleforms_upgrade_lock'] = time();
		$this->assertFalse( \SubtleForms\Activator::maybe_upgrade( '2.4.0' ) );
		$this->assertSame( array(), $GLOBALS['sf_test_dbdelta'] );

		$GLOBALS['sf_test_options']['subtleforms_upgrade_lock'] = time() - 3600;
		$this->assertTrue( \SubtleForms\Activator::maybe_upgrade( '2.4.0' ) );
		$this->assertArrayNotHasKey( 'subtleforms_upgrade_lock', $GLOBALS['sf_test_options'], 'released afterwards' );
	}

	public function test_the_submissions_table_has_the_user_id_column_and_index(): void {
		\SubtleForms\Activator::maybe_upgrade( '2.4.0' );
		$sql = implode( "\n", array_map( 'strval', $GLOBALS['sf_test_dbdelta'] ) );
		$this->assertStringContainsString( 'user_id bigint(20) unsigned NOT NULL DEFAULT 0', $sql );
		$this->assertStringContainsString( 'KEY form_user (form_id, user_id)', $sql );
	}

	public function test_the_plugin_file_uses_the_version_check(): void {
		$main = file_get_contents( dirname( __DIR__, 2 ) . '/subtleforms.php' );
		$this->assertStringContainsString( 'SubtleForms\Activator::maybe_upgrade();', $main );
	}
}
