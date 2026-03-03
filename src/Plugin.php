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
use SubtleForms\Api\LicenseApi;
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
		// Text domain already loaded in subtleforms.php on plugins_loaded.

		// Initialize admin
		if ( is_admin() ) {
			$this->container->get( AdminMenu::class );
		}

		// Register REST API
		add_action(
			'rest_api_init',
			function () {
				$this->container->get( RestController::class )->register_routes();
				$this->container->get( LicenseApi::class )->register_routes();
			}
		);

		// Register frontend shortcode
		add_action(
			'init',
			function () {
				$this->container->get( \SubtleForms\Frontend\Shortcode::class )->register();
			}
		);

		// Register Gutenberg block (single registration via SubtleFormsBlock).
		\SubtleForms\Blocks\SubtleFormsBlock::init();

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

		// Initialize license scheduler
		$this->init_license_scheduler();

		// Initialize async processing (Phase B2)
		$this->init_async_processing();

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
	 * Initialize license scheduler for Pro features.
	 */
	private function init_license_scheduler(): void {
		$scheduler = $this->container->get( \SubtleForms\Licensing\LicenseScheduler::class );
		$scheduler->register();
	}

	/**
	 * Initialize async processing for emails and webhooks.
	 * 
	 * @since 1.8.2
	 */
	private function init_async_processing(): void {
		// Register async email handler
		add_action( 'subtleforms_async_email', array( \SubtleForms\Async\AsyncDispatcher::class, 'executeEmail' ), 10, 1 );

		// Register async webhook handler
		add_action( 'subtleforms_async_webhook', array( \SubtleForms\Async\AsyncDispatcher::class, 'executeWebhook' ), 10, 1 );
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
