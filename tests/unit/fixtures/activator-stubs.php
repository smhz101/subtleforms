<?php
// phpcs:disable -- Unit test stubs; not shipped in production plugin.
/**
 * WordPress stand-ins for running Activator in a unit test process.
 *
 * @package SubtleForms\Tests
 */

defined( 'SUBTLEFORMS_VERSION' ) || define( 'SUBTLEFORMS_VERSION', '2.4.0' );
defined( 'SUBTLEFORMS_PLUGIN_BASENAME' ) || define( 'SUBTLEFORMS_PLUGIN_BASENAME', 'subtleforms/subtleforms.php' );
defined( 'ARRAY_A' ) || define( 'ARRAY_A', 'ARRAY_A' );

if ( ! function_exists( 'add_option' ) ) {
	function add_option( $name, $value = '', $deprecated = '', $autoload = null ) {
		if ( array_key_exists( $name, $GLOBALS['sf_test_options'] ) ) {
			return false;
		}
		$GLOBALS['sf_test_options'][ $name ] = $value;
		return true;
	}
}

if ( ! function_exists( 'delete_option' ) ) {
	function delete_option( $name ) {
		unset( $GLOBALS['sf_test_options'][ $name ] );
		return true;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $name, $value, $autoload = null ) {
		$GLOBALS['sf_test_options'][ $name ] = $value;
		return true;
	}
}

if ( ! function_exists( 'wp_next_scheduled' ) ) {
	function wp_next_scheduled( $hook, $args = array() ) {
		foreach ( $GLOBALS['sf_test_scheduled'] as $event ) {
			if ( $event['hook'] === $hook ) {
				return $event['time'];
			}
		}
		return false;
	}
}

if ( ! function_exists( 'wp_schedule_single_event' ) ) {
	function wp_schedule_single_event( $time, $hook, $args = array(), $wp_error = false ) {
		$GLOBALS['sf_test_scheduled'][] = array( 'time' => $time, 'hook' => $hook, 'recurrence' => null );
		return true;
	}
}

if ( ! function_exists( 'wp_schedule_event' ) ) {
	function wp_schedule_event( $time, $recurrence, $hook, $args = array(), $wp_error = false ) {
		$GLOBALS['sf_test_scheduled'][] = array( 'time' => $time, 'hook' => $hook, 'recurrence' => $recurrence );
		return true;
	}
}

if ( ! function_exists( 'flush_rewrite_rules' ) ) {
	function flush_rewrite_rules( $hard = true ) {}
}

if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $text, $domain = 'default' ) {
		return $text;
	}
}

/**
 * Fake database: every table exists and has the current columns.
 */
class SF_Activator_Wpdb {
	public $prefix  = 'wp_';
	public $options = 'wp_options';

	public function get_charset_collate() {
		return '';
	}

	public function get_var( $sql ) {
		if ( preg_match( "/SHOW TABLES LIKE '([^']+)'/", (string) $sql, $m ) ) {
			return $m[1];
		}
		return null;
	}

	public function get_results( $sql, $output = null ) {
		// SHOW COLUMNS: report each column as present, so nothing is altered.
		return 0 === stripos( trim( (string) $sql ), 'SHOW COLUMNS' ) ? array( (object) array( 'Field' => 'x' ) ) : array();
	}

	public function get_col( $sql ) {
		return array();
	}

	public function query( $sql ) {
		return 1;
	}

	public function update( $table, $data, $where ) {
		return 1;
	}

	public function prepare( $query, ...$args ) {
		return $query;
	}

	public function esc_like( $text ) {
		return $text;
	}
}
