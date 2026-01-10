<?php
/**
 * SubtleForms Autoloader
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Prefer Composer autoloader when available
if ( file_exists( SUBTLEFORMS_PLUGIN_DIR . 'vendor/autoload.php' ) ) {
	require_once SUBTLEFORMS_PLUGIN_DIR . 'vendor/autoload.php';

	// Composer will autoload classes, but standalone functions (like the
	// `SubtleForms\init()` helper) are defined in src/Plugin.php and must
	// be included explicitly.
	if ( file_exists( SUBTLEFORMS_PLUGIN_DIR . 'src/Plugin.php' ) ) {
		require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Plugin.php';
	}

	return;
}

// Fallback to manual includes for development environments
// Contracts first
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Contracts/ExtensionInterface.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Contracts/ActionInterface.php';

// Core
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Container.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Plugin.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Activator.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Deactivator.php';

// Engine
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/PipelineStepInterface.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/PipelineStep.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/PipelineResult.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/ActionRegistry.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/SubmissionContext.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/Pipeline.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Engine/ActionDefinition.php';

// Support
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Support/Logger.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Support/Capabilities.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Support/FeatureGate.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Support/Helpers.php';

// Extensions
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Extensions/ExtensionManager.php';

// Admin / API
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Admin/AdminMenu.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Api/RestController.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Frontend/Shortcode.php';

// Repositories
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Repositories/FormsRepository.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Repositories/SubmissionsRepository.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Repositories/LogsRepository.php';

// Blocks
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Blocks/SubtleFormsBlock.php';
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/Blocks/SubtleFormsFormBlock.php';
