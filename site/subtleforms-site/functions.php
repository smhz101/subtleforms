<?php
/**
 * SubtleForms Site theme bootstrap.
 *
 * Everything the owner edits lives in theme.json, patterns and parts.
 * This file only registers block styles, pattern categories, the two
 * custom blocks and the stylesheet.
 *
 * @package SubtleFormsSite
 */

defined( 'ABSPATH' ) || exit;

define( 'SF_SITE_VERSION', '0.1.0' );
define( 'SF_SITE_DIR', get_template_directory() );
define( 'SF_SITE_URI', get_template_directory_uri() );

require_once SF_SITE_DIR . '/inc/block-styles.php';
require_once SF_SITE_DIR . '/inc/patterns.php';
require_once SF_SITE_DIR . '/inc/blocks.php';
require_once SF_SITE_DIR . '/inc/setup.php';
