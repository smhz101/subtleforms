<?php
// phpcs:disable -- Test bootstrap; not shipped in production plugin.
/**
 * Boot a real WordPress for integration tests.
 *
 * WP_LOAD points at the site's wp-load.php (default: the local test site).
 * SF_TEST_SKIP_PLUGINS is a comma-separated list of plugin folders to leave
 * out for the run (for example a plugin another developer is editing).
 *
 * @package SubtleForms\Tests\WP
 */

$wp_load = getenv( 'WP_LOAD' ) ?: '/home/claude/wp/site/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
	fwrite( STDERR, "wp-load.php not found at {$wp_load}. Set WP_LOAD.\n" );
	exit( 1 );
}

$_SERVER['HTTP_HOST']   = $_SERVER['HTTP_HOST'] ?? ( getenv( 'WP_HOST' ) ?: 'localhost' );
$_SERVER['SERVER_NAME'] = $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'];
$_SERVER['REQUEST_URI'] = $_SERVER['REQUEST_URI'] ?? '/';
$_SERVER['REMOTE_ADDR'] = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

$skip = array_filter( array_map( 'trim', explode( ',', (string) getenv( 'SF_TEST_SKIP_PLUGINS' ) ) ) );
if ( $skip ) {
	// Hooks registered before WordPress loads (WP_Hook pre-initialisation).
	$GLOBALS['wp_filter']['option_active_plugins'][10][] = array(
		'function'      => static function ( $plugins ) use ( $skip ) {
			return array_values(
				array_filter(
					(array) $plugins,
					static function ( $plugin ) use ( $skip ) {
						return ! in_array( strtok( (string) $plugin, '/' ), $skip, true );
					}
				)
			);
		},
		'accepted_args' => 1,
	);
}

define( 'WP_USE_THEMES', false );
require_once $wp_load;

if ( ! class_exists( \SubtleForms\Plugin::class ) ) {
	fwrite( STDERR, "SubtleForms is not active on this site.\n" );
	exit( 1 );
}

require_once __DIR__ . '/TestCase.php';
