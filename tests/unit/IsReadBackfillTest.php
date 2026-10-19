<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Review finding on #2 to #13 (PR #35): adding the is_read column marks
 * entries that older builds stored with status "read" as read.
 *
 * @package SubtleForms\Tests
 */

use SubtleForms\Activator;

/** Fake database that records queries and reports the column missing. */
final class SfTestIsReadWpdb {
	public $prefix  = 'wp_';
	public $queries = array();
	public function get_results( $sql ) {
		$this->queries[] = $sql;
		return array();
	}
	public function query( $sql ) {
		$this->queries[] = $sql;
		return 1;
	}
}

class IsReadBackfillTest extends PHPUnit\Framework\TestCase {

	public function test_new_is_read_column_is_filled_from_the_old_read_status(): void {
		$saved           = $GLOBALS['wpdb'] ?? null;
		$GLOBALS['wpdb'] = new SfTestIsReadWpdb();
		try {
			$method = new ReflectionMethod( Activator::class, 'migrate_is_read_column' );
			$method->setAccessible( true );
			$method->invoke( null );
			$sql = implode( "\n", $GLOBALS['wpdb']->queries );
		} finally {
			$GLOBALS['wpdb'] = $saved;
		}
		$add      = strpos( $sql, 'ADD COLUMN is_read' );
		$backfill = strpos( $sql, "SET is_read = 1 WHERE status = 'read'" );
		$this->assertNotFalse( $add );
		$this->assertNotFalse( $backfill );
		$this->assertGreaterThan( $add, $backfill );
	}
}
