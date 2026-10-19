<?php
/**
 * SubtleForms uninstall.
 *
 * Fired when the plugin is deleted from the WordPress admin.
 *
 * @package SubtleForms
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require_once __DIR__ . '/vendor/autoload.php';

\SubtleForms\Support\Uninstaller::run();
