<?php
/**
 * SubtleForms Plugin Main Class
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Api\RestController;
use SubtleForms\Extensions\ExtensionManager;

/**
 * Main plugin orchestrator.
 */
final class Plugin {

	private Container $container;
	private static ?Plugin $instance = null;

	private function __construct() {
		$this->container = new Container();
		$this->container->bootstrap();
	}

	/**
	 * Get the singleton instance.
	 */
	public static function instance(): Plugin {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Get the container.
	 */
	public function container(): Container {
		return $this->container;
	}

	/**
	 * Initialize the plugin.
	 */
	public function init(): void {
		// Load text domain for translations
		add_action( 'init', array( $this, 'load_textdomain' ) );

		// Initialize admin
		if ( is_admin() ) {
			$this->container->get( AdminMenu::class );
		}

		// Register REST API
		add_action(
			'rest_api_init',
			function () {
				$this->container->get( RestController::class )->register_routes();
			}
		);

		// Register frontend shortcode
		add_action(
			'init',
			function () {
				$this->container->get( \SubtleForms\Frontend\Shortcode::class )->register();
			}
		);

		// Register Gutenberg block
		\SubtleForms\Blocks\SubtleFormsBlock::init();

		// Register form embed block (only once on init)
		add_action(
			'init',
			function () {
				static $registered = false;
				if ( $registered ) {
					return;
				}
				$formBlock = new \SubtleForms\Blocks\SubtleFormsFormBlock();
				$formBlock->register_block();
				$registered = true;
			}
		);

		// Boot extensions
		add_action(
			'init',
			function () {
				$this->container->get( ExtensionManager::class )->boot();
			},
			20
		);

		// Initialize privacy features
		$this->init_privacy();

		// Allow other plugins/themes to hook in
		do_action( 'subtleforms/loaded', $this );
	}

	/**
	 * Load plugin text domain.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain(
			'subtleforms',
			false,
			dirname( plugin_basename( SUBTLEFORMS_PLUGIN_FILE ) ) . '/languages'
		);
	}

	/**
	 * Initialize privacy features for GDPR compliance.
	 */
	private function init_privacy(): void {
		$privacy_exporter = $this->container->get( \SubtleForms\Privacy\PrivacyExporter::class );
		$privacy_eraser   = $this->container->get( \SubtleForms\Privacy\PrivacyEraser::class );
		$privacy_manager  = $this->container->get( \SubtleForms\Privacy\PrivacyManager::class );

		// Register exporters and erasers
		add_filter( 'wp_privacy_personal_data_exporters', array( $privacy_exporter, 'register_exporter' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( $privacy_eraser, 'register_eraser' ) );

		// Initialize privacy manager (handles cron and policy content)
		$privacy_manager->init();
	}

	/**
	 * Get a service from the container.
	 */
	public function get( string $id ) {
		return $this->container->get( $id );
	}
}

/**
 * Helper function to get the plugin instance.
 */
function plugin(): Plugin {
	return Plugin::instance();
}

/**
 * Initialize the plugin.
 */
function init(): void {
	Plugin::instance()->init();
}
