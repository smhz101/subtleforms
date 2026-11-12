<?php
/**
 * Plugin Name: SubtleForms address flags feature
 * Description: Test only. Declares the address_flags add-on feature while the cookie sf_test_address_flags is set, the way an add-on does with the subtleforms/addon/features filter. wp-env maps this file into mu-plugins (see .wp-env.json); copy it there on another site.
 */
// phpcs:disable -- Test fixture; not shipped in production plugin.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
add_filter(
	'subtleforms/addon/features',
	static function ( $features ) {
		if ( ! empty( $_COOKIE['sf_test_address_flags'] ) ) {
			$features   = is_array( $features ) ? $features : array();
			$features[] = 'address_flags';
		}
		return $features;
	}
);
