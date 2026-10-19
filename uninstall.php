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

require_once __DIR__ . '/src/Support/Uninstaller.php';

\SubtleForms\Support\Uninstaller::run();
