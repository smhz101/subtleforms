<?php
// phpcs:disable -- Test fixture; not shipped in production plugin.
/**
 * Add entries to a form on the test site, through WP-CLI, without going
 * through the public endpoint and its per-minute limit:
 *
 *   wp eval-file tests/browser/fixtures/entries-seed.php <form_id> <count>
 *
 * Prints {"created": <count>} as JSON.
 *
 * @package SubtleForms\Tests
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$subtleforms_seed_form  = isset( $args[0] ) ? (int) $args[0] : 0;
$subtleforms_seed_count = isset( $args[1] ) ? max( 0, min( 500, (int) $args[1] ) ) : 0;

$subtleforms_seed_repo    = new \SubtleForms\Repositories\SubmissionsRepository();
$subtleforms_seed_created = 0;
for ( $i = 1; $subtleforms_seed_form > 0 && $i <= $subtleforms_seed_count; $i++ ) {
	$subtleforms_seed_repo->create(
		array(
			'form_id' => $subtleforms_seed_form,
			'payload' => array( 'name' => 'Seeded entry ' . $i ),
			'status'  => 'unread',
		)
	);
	++$subtleforms_seed_created;
}

echo wp_json_encode( array( 'created' => $subtleforms_seed_created ) );
