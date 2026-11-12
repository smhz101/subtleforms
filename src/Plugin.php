<?php


/**
 * SubtleForms Plugin Main Class
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Admin\AdminNotices;
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
		// Text domain already loaded in subtleforms.php on plugins_loaded.

		// Initialize admin
		if ( is_admin() ) {
			$this->container->get( AdminMenu::class );
			AdminNotices::register();
			\SubtleForms\Admin\DashboardWidget::register();
		}
		// The admin bar shows on the front end too.
		\SubtleForms\Admin\AdminBar::register();

		// Register REST API
		add_action(
			'rest_api_init',
			function () {
				$this->container->get( RestController::class )->register_routes();
			}
		);

		// A form post without AJAX goes to the page itself, not to REST, so its
		// handler is hooked on every front-end request (2.8.1). It was hooked
		// from the REST routes before, which a page request never reaches.
		if ( ! is_admin() ) {
			add_action(
				'template_redirect',
				function () {
					$this->container->get( \SubtleForms\Api\PublicSubmitApi::class )->handleClassicPost();
				}
			);
		}

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
				$manager = $this->container->get( ExtensionManager::class );

				// The container is built inside plugins_loaded (priority 10), so
				// its plugins_loaded@5 callback that fills the manager has
				// already been missed. Fire the registration hook here instead,
				// once, before booting.
				if ( ! did_action( 'subtleforms/register_extensions' ) ) {
					/** This action is documented in src/Container.php */
					do_action( 'subtleforms/register_extensions', $manager );
				}

				$manager->boot();
			},
			20
		);

		// The entries CSV, streamed as a file (2.8.1). admin-post.php does not
		// run the REST routes, so the handler is hooked here.
		add_action(
			'admin_post_subtleforms_export_csv',
			function () {
				( new \SubtleForms\Api\SubmissionsApi(
					new \SubtleForms\Repositories\FormsRepository(),
					new \SubtleForms\Repositories\SubmissionsRepository(),
					$this->container->get( \SubtleForms\Support\FeatureGate::class )
				) )->downloadCsv();
			}
		);

		// File and image uploads: endpoint, admin downloads, clean-up (2.1).
		\SubtleForms\Uploads\Uploads::register();
		\SubtleForms\Tools\EntrySchemaMigration::register();
		\SubtleForms\Fields\FieldTypeAvailability::register();
		\SubtleForms\Security\PublicRoutes::register();

		// Initialize privacy features
		$this->init_privacy();

		// Initialize async processing (Phase B2)
		$this->init_async_processing();

		// Blocked spam counter (2.6.0).
		\SubtleForms\Analytics\SpamStats::register();
		\SubtleForms\Security\RateLimitStore::register();
		\SubtleForms\Support\SpamDefaults::register();
		\SubtleForms\Support\ImportOffer::register();
		\SubtleForms\Support\ThemeStyles::register();
		\SubtleForms\Admin\ThemePreviewAssets::register();

		// Allow other plugins/themes to hook in
		do_action( 'subtleforms/loaded', $this );
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
	 * Initialize async processing for emails and webhooks.
	 * 
	 * @since 1.8.2
	 */
	private function init_async_processing(): void {
		// Register async email handler
		add_action( 'subtleforms_async_email', array( \SubtleForms\Async\AsyncDispatcher::class, 'executeEmail' ), 10, 1 );

		// Stored details of jobs that never ran are removed after a week.
		add_action( 'subtleforms_daily_cleanup', array( \SubtleForms\Async\AsyncDispatcher::class, 'pruneOrphans' ) );

		// Register async webhook handler
		add_action( 'subtleforms_async_webhook', array( \SubtleForms\Async\AsyncDispatcher::class, 'executeWebhook' ), 10, 1 );

		// Email marketing (Mailchimp, Brevo, Kit): queue a job for each saved entry, and run it.
		add_action( 'subtleforms_async_email_marketing', array( \SubtleForms\Async\AsyncDispatcher::class, 'executeEmailMarketing' ), 10, 1 );
		\SubtleForms\Integrations\EmailMarketing\Sender::register();

		// CRM (HubSpot): the same, for contacts.
		add_action( 'subtleforms_async_crm', array( \SubtleForms\Async\AsyncDispatcher::class, 'executeCrm' ), 10, 1 );
		\SubtleForms\Integrations\Crm\Sender::register();
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
