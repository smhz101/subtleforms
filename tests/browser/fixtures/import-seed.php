<?php
// phpcs:disable -- Test fixture; not shipped in production plugin.
/**
 * Seed or remove the import fixtures on the test site, through WP-CLI:
 *
 *   wp eval-file tests/browser/fixtures/import-seed.php seed
 *   wp eval-file tests/browser/fixtures/import-seed.php clean
 *
 * `seed` prints the ids it created as JSON. Contact Form 7, Gravity Forms and
 * Fluent Forms do not need to be installed: their data is written where they
 * keep it.
 *
 * @package SubtleForms\Tests
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__, 2 ) . '/fixtures/import/Seeder.php';

$subtleforms_seed_action = isset( $args[0] ) ? (string) $args[0] : 'seed';

if ( 'clean' === $subtleforms_seed_action ) {
	\SubtleForms\Tests\Fixtures\ImportSeeder::clean();
	echo wp_json_encode( array( 'clean' => true ) );
	return;
}

\SubtleForms\Tests\Fixtures\ImportSeeder::clean();
echo wp_json_encode( \SubtleForms\Tests\Fixtures\ImportSeeder::seed() );
