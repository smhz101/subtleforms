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
final class Plugin
{
    private Container $container;
    private static ?Plugin $instance = null;

    private function __construct()
    {
        $this->container = new Container();
        $this->container->bootstrap();
    }

    /**
     * Get the singleton instance.
     */
    public static function instance(): Plugin
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Get the container.
     */
    public function container(): Container
    {
        return $this->container;
    }

    /**
     * Initialize the plugin.
     */
    public function init(): void
    {
        // Load text domain for translations
        add_action('init', [$this, 'load_textdomain']);

        // Initialize admin
        if (is_admin()) {
            $this->container->get(AdminMenu::class);
        }

        // Register REST API
        add_action('rest_api_init', function () {
            $this->container->get(RestController::class)->register_routes();
        });

        // Register frontend shortcode
        add_action('init', function () {
            $this->container->get(\SubtleForms\Frontend\Shortcode::class)->register();
        });

        // Boot extensions
        add_action('init', function () {
            $this->container->get(ExtensionManager::class)->boot();
        }, 20);

        // Allow other plugins/themes to hook in
        do_action('subtleforms/loaded', $this);
    }

    /**
     * Load plugin text domain.
     */
    public function load_textdomain(): void
    {
        load_plugin_textdomain(
            'subtleforms',
            false,
            dirname(plugin_basename(SUBTLEFORMS_PLUGIN_FILE)) . '/languages'
        );
    }

    /**
     * Get a service from the container.
     */
    public function get(string $id)
    {
        return $this->container->get($id);
    }
}

/**
 * Helper function to get the plugin instance.
 */
function plugin(): Plugin
{
    return Plugin::instance();
}

/**
 * Initialize the plugin.
 */
function init(): void
{
    Plugin::instance()->init();
}