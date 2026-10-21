<?php


/**
 * SubtleForms Admin Menu
 *
 * @package   SubtleForms\Admin
 * @version   0.1.0
 */

namespace SubtleForms\Admin;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Support\Capabilities;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Helpers;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

/**
 * Admin menu and interface management.
 */
class AdminMenu {

	/**
	 * @var Capabilities
	 */
	private $caps;

	/**
	 * @var FormsRepository
	 */
	private $formsRepo;

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @var string
	 */
	private $currentPage = '';

	public function __construct(
		Capabilities $caps,
		?FormsRepository $formsRepo = null,
		?SubmissionsRepository $submissionsRepo = null
	) {
		$this->caps          = $caps;
		$this->formsRepo     = $formsRepo ?? new FormsRepository();
		$this->submissionsRepo = $submissionsRepo ?? new SubmissionsRepository();

		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'menu_icon_styles' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		// WordPress checks access to a page right after `admin_menu`, so the
		// old Tools URL is sent on before that check.
		add_action( 'admin_menu', array( $this, 'redirect_legacy_pages' ), 1 );
		add_action( 'admin_init', array( $this, 'handle_actions' ) );
		add_filter( 'admin_body_class', array( $this, 'filter_admin_body_class' ) );
		// Hook title filter with highest priority to catch null values first
		add_filter( 'admin_title', array( $this, 'filter_admin_title' ), 1, 2 );
		// Fix globals early before WordPress uses them
		add_action( 'admin_init', array( $this, 'fix_admin_globals' ), 1 );
		// Fix menu highlighting for correct active states
		add_filter( 'parent_file', array( $this, 'fix_parent_file' ) );
		add_filter( 'submenu_file', array( $this, 'fix_submenu_file' ) );

		add_action(
			'admin_menu',
			function () {
				global $submenu;

				if ( isset( $submenu['subtleforms'][0] ) ) {
					$submenu['subtleforms'][0][0] = __( 'Dashboard', 'subtleforms' );
				}
			},
			100
		);
	}

	/**
	 * Get submission menu title with unread count badge.
	 */
	/**
	 * Get the site domain (host without scheme/path), lowercased.
	 *
	 * Used by the Settings screen to flag a sender email whose domain does
	 * not match the site domain (Part B20).
	 *
	 * @return string
	 */
	private function get_site_domain(): string {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( empty( $host ) ) {
			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated, WordPress.Security.NonceVerification.Recommended -- Read-only fallback.
			$host = isset( $_SERVER['HTTP_HOST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';
		}
		if ( empty( $host ) ) {
			$host = 'localhost';
		}
		return strtolower( $host );
	}

	/**
	 * Number of unread submissions, for the navigation badge.
	 *
	 * @return int
	 */
	private function get_unread_count(): int {
		try {
			return (int) $this->submissionsRepo->count( array( 'is_read' => 0 ) );
		} catch ( \Exception $e ) {
			return 0;
		}
	}

	private function getSubmissionMenuTitle(): string {
		$baseTitle = esc_html__( 'Submissions', 'subtleforms' );

		try {
			$unreadCount = $this->submissionsRepo->count( array( 'is_read' => 0 ) );

			if ( $unreadCount > 0 ) {
				$badge = sprintf( '<span class="awaiting-mod count-%d"><span class="pending-count">%d</span></span>', $unreadCount, $unreadCount );
				return $baseTitle . ' ' . $badge;
			}
		} catch ( \Exception $e ) {
			// Silently fail if there's an issue getting the count
		}

		return $baseTitle;
	}

	/**
	 * Menu mark, the same tile used in the admin header.
	 *
	 * @return string
	 */
	private static function menu_icon(): string {
		// A file URL is drawn as an <img>. A data-URI SVG is painted as a flat
		// admin-menu shape, which turns this mark into a white square.
		return SUBTLEFORMS_PLUGIN_URL . 'assets/menu-icon.svg';
	}

	/**
	 * Keep the menu mark at the header size. Core fades and pads image icons.
	 */
	public function menu_icon_styles(): void {
		wp_register_style( 'subtleforms-menu-icon', false, array(), SUBTLEFORMS_VERSION );
		wp_enqueue_style( 'subtleforms-menu-icon' );
		wp_add_inline_style(
			'subtleforms-menu-icon',
			'#adminmenu #toplevel_page_subtleforms .wp-menu-image img{width:20px;height:20px;padding:7px 0 0;opacity:1;object-fit:contain;}'
		);
	}

	/**
	 * Register admin menu pages.
	 */
	public function register_menu() {
		// Main menu page - Dashboard
		$branding = self::branding();
		add_menu_page(
			$branding['menuName'],
			$branding['menuName'],
			$this->caps->manage_cap(),
			'subtleforms',
			array( $this, 'render_dashboard' ),
			self::menu_icon(),
			56
		);

		// Dashboard submenu (rename the first item)
		// add_submenu_page(
		// 'subtleforms',
		// __('Dashboard', 'subtleforms'),
		// __('Dashboard', 'subtleforms'),
		// $this->caps->manage_cap(),
		// 'subtleforms',
		// [$this, 'render_dashboard']
		// );

		// All Forms
		add_submenu_page(
			'subtleforms',
			__( 'All Forms', 'subtleforms' ),
			__( 'All Forms', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-forms',
			array( $this, 'render_forms' )
		);

		// Add New Form
		add_submenu_page(
			'subtleforms',
			__( 'Add New Form', 'subtleforms' ),
			__( 'Add New', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-new-form',
			array( $this, 'render_new_form' )
		);

		// Submissions with count badge
		$submissionMenuTitle = $this->getSubmissionMenuTitle();
		add_submenu_page(
			'subtleforms',
			__( 'Submissions', 'subtleforms' ),
			$submissionMenuTitle,
			$this->caps->manage_cap(),
			'subtleforms-submissions',
			array( $this, 'render_submissions' )
		);

		// Reports. Views and conversion stay behind Pro.
		add_submenu_page(
			'subtleforms',
			__( 'Reports', 'subtleforms' ),
			__( 'Reports', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-reports',
			array( $this, 'render_reports' )
		);

		// Payments and coupons (2.1)
		add_submenu_page(
			'subtleforms',
			__( 'Payments', 'subtleforms' ),
			__( 'Payments', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-payments',
			array( $this, 'render_payments' )
		);

		// Extensions
		add_submenu_page(
			'subtleforms',
			__( 'Extensions', 'subtleforms' ),
			__( 'Extensions', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-extensions',
			array( $this, 'render_extensions' )
		);

		// Settings
		add_submenu_page(
			'subtleforms',
			__( 'Settings', 'subtleforms' ),
			__( 'Settings', 'subtleforms' ),
			$this->caps->manage_cap(),
			'subtleforms-settings',
			array( $this, 'render_settings' )
		);

		// Allow extensions to add their own pages
		do_action( 'subtleforms/admin_menu', $this->caps );
	}

	/**
	 * Enqueue admin assets.
	 */
	public function enqueue_assets( string $hook ): void {
		// Ensure $hook is never null
		$hook = Helpers::normalize_string( $hook );

		// Only load on our admin pages
		if ( strpos( $hook, 'subtleforms' ) === false ) {
			return;
		}

		$this->currentPage = $hook;

		// Base styling for every @wordpress/components primitive this app uses -
		// Button, Panel, ToggleControl, SelectControl, DropdownMenu, Popover,
		// Modal, SnackbarList and the rest. `wp-components` is registered as a
		// script handle AND a separate style handle; depending on the script (as
		// the bundle below does) pulls in none of the CSS. Without this, every
		// one of those elements renders with no background, border, spacing or
		// shadow from WordPress core, only the few `.components-*` rules this
		// plugin overrides, which is what made the admin look unstyled rather
		// than merely differently themed.
		wp_enqueue_style( 'wp-components' );

		// Main admin CSS
		wp_enqueue_style(
			'subtleforms-admin',
			SUBTLEFORMS_PLUGIN_URL . 'assets/css/admin.css',
			array( 'wp-components' ),
			SUBTLEFORMS_VERSION
		);

		wp_add_inline_style(
			'subtleforms-admin',
			'.subtleforms-placeholder{text-align:center;padding:60px 20px;max-width:800px;margin:0 auto}.subtleforms-placeholder-icon{font-size:64px;color:#ddd;margin-bottom:20px}.subtleforms-placeholder h2{font-size:24px;margin-bottom:10px}.subtleforms-quick-list{margin-top:40px;text-align:left}'
		);

		// Component styles from wp-scripts build (Settings, Dashboard, etc.)
		wp_enqueue_style(
			'subtleforms-components',
			SUBTLEFORMS_PLUGIN_URL . 'build/admin/index.jsx.css',
			array( 'subtleforms-admin' ),
			SUBTLEFORMS_VERSION
		);

		if ( $this->is_builder_screen( $hook ) ) {
			// Media Library for Picture Choice images (2.0).
			if ( function_exists( 'wp_enqueue_media' ) ) {
				wp_enqueue_media();
			}

			wp_enqueue_style(
				'subtleforms-admin-builder',
				SUBTLEFORMS_PLUGIN_URL . 'assets/css/admin-builder.css',
				array( 'subtleforms-admin' ),
				SUBTLEFORMS_VERSION
			);
		}

		// Main admin JS (built bundle at build/admin/admin.js)
		$asset_file = SUBTLEFORMS_PLUGIN_DIR . 'build/admin/admin.asset.php';
		if ( file_exists( $asset_file ) ) {
			$asset = include $asset_file;
			wp_enqueue_script(
				'subtleforms-admin',
				SUBTLEFORMS_PLUGIN_URL . 'build/admin/admin.js',
				$asset['dependencies'] ?? array( 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' ),
				$asset['version'] ?? SUBTLEFORMS_VERSION,
				true
			);
		} else {
			wp_enqueue_script(
				'subtleforms-admin',
				SUBTLEFORMS_PLUGIN_URL . 'build/admin/admin.js',
				array( 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' ),
				SUBTLEFORMS_VERSION,
				true
			);
		}

		// Expose build URL so webpack async chunks (code-split pages) load correctly.
		// This must run BEFORE the admin script executes.
		wp_add_inline_script(
			'subtleforms-admin',
			sprintf(
				'window.__subtleformsPublicPath = %s;',
				wp_json_encode( SUBTLEFORMS_PLUGIN_URL . 'build/admin/' )
			),
			'before'
		);

		// Get license data, provided by the Pro plugin via filter (no API calls).
		$license_data = apply_filters( 'subtleforms/license_data', null );

		// Rebuild Capabilities fresh at enqueue time.
		// AdminMenu is constructed on plugins_loaded BEFORE Pro registers its
		// subtleforms/capabilities filter, so $this->caps is stale. A fresh
		// instance picks up all filters that are now in place.
		$live_caps = new Capabilities();

		$admin_data = array(
			'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
			'restUrl'        => rest_url( 'subtleforms/v1' ),
			'nonce'          => wp_create_nonce( 'subtleforms_admin' ),
			'restNonce'      => wp_create_nonce( 'wp_rest' ),
			'version'        => SUBTLEFORMS_VERSION,
			'currency'       => strtoupper( (string) ( ( get_option( 'subtleforms_settings', array() )['ext_payments_currency'] ?? '' ) ?: 'USD' ) ),
			'unreadCount'    => $this->get_unread_count(),
			'capabilities'   => $live_caps->all(),
			'hasProPlugin'   => defined( 'SUBTLEFORMS_PRO_VERSION' ) || subtleforms_is_pro_active(),
			'missingFieldTypes' => \SubtleForms\Fields\AddonFieldTypes::missing(),
			'license'        => $license_data,
			'subscription'   => array(
				'status'    => 'inactive',
				'plan'      => 'free',
				'connected' => false,
			),
			'extensions'     => $this->buildExtensionsData( $live_caps ),
			'isDev'          => defined( 'WP_DEBUG' ) && WP_DEBUG,
			// The builder preview renders the real frontend markup inside an
			// iframe, so it needs the public stylesheet to look like production
			// rather than approximating it with admin styles.
			'frontendStyles' => array_values(
				array_filter(
					array(
						file_exists( SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/index.jsx.css' )
							? add_query_arg(
								'ver',
								(string) filemtime( SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/index.jsx.css' ),
								SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css'
							)
							: null,
						file_exists( SUBTLEFORMS_PLUGIN_DIR . 'assets/css/conversational.css' )
							? SUBTLEFORMS_PLUGIN_URL . 'assets/css/conversational.css'
							: null,
					)
				)
			),
			'i18n'           => array(
				'confirmDelete' => __( 'Are you sure you want to delete this item?', 'subtleforms' ),
				'error'         => __( 'An error occurred. Please try again.', 'subtleforms' ),
				'success'       => __( 'Action completed successfully.', 'subtleforms' ),
			),
			// WooCommerce status for the checkout settings (2.1). Null when inactive.
			'woocommerce'    => self::woocommerceData(),
			// Nonce for admin download links to uploaded files (2.1).
			'fileNonce'      => \SubtleForms\Uploads\Uploads::nonce(),
			// Name, logo and which credits/links to show (white label, 2.1).
			'branding'       => self::branding(),
			// Preview device widths and the active theme's styles, so "inherit
			// from theme" and desktop/tablet/mobile match the site (2.3.5).
			'previewBreakpoints' => \SubtleForms\Support\Appearance::previewBreakpoints( self::themeJsonSettings() ),
			'themeStylesheets'   => self::themeStylesheets(),
			'themeGlobalCss'     => function_exists( 'wp_get_global_stylesheet' ) ? wp_get_global_stylesheet() : '',
			'themeFontFaces'     => self::themeFontFaces(),
			// Submissions inbox. A personal choice wins; otherwise these are the site defaults.
			'submissionsView'    => ( new Settings() )->resolvedInboxView( get_current_user_id() ),
		);

		/**
		 * Filter the data the admin app receives as `window.subtleformsAdmin`.
		 * Add-ons add their own keys here.
		 *
		 * @param array  $admin_data Data.
		 * @param string $hook       Admin page hook.
		 * @since 2.1.0
		 */
		$admin_data = (array) apply_filters( 'subtleforms/admin_data', $admin_data, $hook );

		// Localize script with data
		wp_localize_script( 'subtleforms-admin', 'subtleformsAdmin', $admin_data );
		wp_set_script_translations( 'subtleforms-admin', 'subtleforms', SUBTLEFORMS_PLUGIN_DIR . 'languages' );

		// Additional data for Settings page
		wp_localize_script(
			'subtleforms-admin',
			'subtleformsData',
			array(
				'siteName'   => get_option( 'blogname' ),
				'adminEmail' => get_option( 'admin_email' ),
				'siteDomain' => $this->get_site_domain(),
			)
		);

		// Allow extensions to enqueue their assets
		do_action( 'subtleforms/admin_enqueue_scripts', $hook );
	}

	/**
	 * theme.json settings for the active theme, or an empty array.
	 *
	 * @return array
	 */
	private static function themeJsonSettings(): array {
		if ( ! class_exists( '\WP_Theme_JSON_Resolver' ) ) {
			return array();
		}

		$data = \WP_Theme_JSON_Resolver::get_merged_data( 'theme' );
		if ( ! is_object( $data ) || ! method_exists( $data, 'get_settings' ) ) {
			return array();
		}

		$settings = $data->get_settings();
		return is_array( $settings ) ? $settings : array();
	}


	/**
	 * Stylesheet URLs for the active theme. Global styles are passed separately
	 * through wp_get_global_stylesheet(). This does not run front-end hooks.
	 *
	 * @return string[]
	 */
	/**
	 * Font faces the front end prints, so the builder preview can use them.
	 *
	 * @return string
	 */
	public static function themeFontFaces(): string {
		if ( ! function_exists( 'wp_print_font_faces' ) ) {
			return '';
		}
		ob_start();
		wp_print_font_faces();
		return (string) ob_get_clean();
	}

	private static function themeStylesheets(): array {
		$hrefs = array();
		if ( function_exists( 'is_child_theme' ) && is_child_theme() && function_exists( 'get_template_directory_uri' ) ) {
			$hrefs[] = get_template_directory_uri() . '/style.css';
		}
		if ( function_exists( 'get_stylesheet_uri' ) ) {
			$child = get_stylesheet_uri();
			if ( is_string( $child ) && '' !== $child && ! in_array( $child, $hrefs, true ) ) {
				$hrefs[] = $child;
			}
		}
		return $hrefs;
	}

	/**
	 * How the admin app presents the plugin: name, logo and which SubtleForms
	 * credits, help links and upgrade prompts appear.
	 *
	 * @return array{name:string,menuName:string,logoUrl:string,hideCredits:bool,hideHelp:bool,hideUpgrade:bool,showLicense:bool,supportUrl:string}
	 */
	public static function branding(): array {
		static $cache = null;
		if ( $cache !== null && ! ( defined( 'SUBTLEFORMS_TESTING' ) && SUBTLEFORMS_TESTING ) ) {
			return $cache;
		}

		$defaults = array(
			'name'        => 'SubtleForms',
			'menuName'    => __( 'SubtleForms', 'subtleforms' ),
			'logoUrl'     => '',
			'hideCredits' => false,
			'hideHelp'    => false,
			'hideUpgrade' => false,
			'showLicense' => true,
			'supportUrl'  => '',
		);

		/**
		 * Filter the admin branding (white label). SubtleForms Pro's Branding
		 * settings use this on the Agency plan.
		 *
		 * @param array $branding {
		 *     @type string $name        Product name in the app header and copy.
		 *     @type string $menuName    wp-admin menu label.
		 *     @type string $logoUrl     Logo image URL; empty for the default mark.
		 *     @type bool   $hideCredits Hide SubtleForms credits and links.
		 *     @type bool   $hideHelp    Hide the Help menu.
		 *     @type bool   $hideUpgrade Hide upgrade prompts.
		 *     @type bool   $showLicense Show the License screen to this user.
		 *     @type string $supportUrl  Where "Get support" links to; empty for SubtleForms (2.3.0).
		 * }
		 * @since 2.1.0
		 */
		$b = apply_filters( 'subtleforms/admin_branding', $defaults );
		$b = is_array( $b ) ? array_merge( $defaults, $b ) : $defaults;

		$name  = trim( wp_strip_all_tags( (string) $b['name'] ) );
		$menu  = trim( wp_strip_all_tags( (string) $b['menuName'] ) );
		$cache = array(
			'name'        => $name !== '' ? $name : $defaults['name'],
			'menuName'    => $menu !== '' ? $menu : ( $name !== '' && $name !== $defaults['name'] ? $name : $defaults['menuName'] ),
			'logoUrl'     => esc_url_raw( (string) $b['logoUrl'] ),
			'hideCredits' => (bool) $b['hideCredits'],
			'hideHelp'    => (bool) $b['hideHelp'],
			'hideUpgrade' => (bool) $b['hideUpgrade'],
			'showLicense' => (bool) $b['showLicense'],
			'supportUrl'  => esc_url_raw( (string) $b['supportUrl'], array( 'http', 'https', 'mailto' ) ),
		);
		return $cache;
	}

	/**
	 * WooCommerce details for the admin app, or null when it is not active.
	 *
	 * @return array{active:bool,version:string,currency:string,symbol:string,checkoutUrl:string,cartUrl:string,couponsUrl:string}|null
	 */
	public static function woocommerceData(): ?array {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'get_woocommerce_currency' ) ) {
			return null;
		}
		$currency = get_woocommerce_currency();
		return array(
			'active'      => true,
			'version'     => defined( 'WC_VERSION' ) ? (string) WC_VERSION : '',
			'currency'    => $currency,
			'symbol'      => html_entity_decode( (string) get_woocommerce_currency_symbol( $currency ), ENT_QUOTES, 'UTF-8' ),
			'checkoutUrl' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
			'cartUrl'     => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
			'couponsUrl'  => admin_url( 'edit.php?post_type=shop_coupon' ),
		);
	}

	/**
	 * Build the extensions data array for the front end.
	 *
	 * Returns a map of slug => {label, enabled, configured, available} where:
	 *   - enabled:    admin has turned the extension on in Settings
	 *   - configured: the required API keys / settings appear to be present
	 *   - available:  the capability gate allows this extension (Pro licence)
	 */
	private function buildExtensionsData( ?Capabilities $caps = null ): array {
		$settings = new \SubtleForms\Support\Settings();
		$gate     = new \SubtleForms\Support\FeatureGate( $caps ?? $this->caps );

		$extensions = array(
			array(
				'slug'        => 'webhooks',
				'label'       => __( 'Webhooks', 'subtleforms' ),
				'description' => __( 'Send each entry as JSON to any URL, with retries and signed requests.', 'subtleforms' ),
			),
			array(
				'slug'        => 'email_marketing',
				'label'       => __( 'Email Marketing', 'subtleforms' ),
				'description' => __( 'Add people who fill in a form to Mailchimp, Brevo or Kit.', 'subtleforms' ),
			),
			array(
				'slug'        => 'crm',
				'label'       => __( 'CRM', 'subtleforms' ),
				'description' => __( 'Create or update HubSpot contacts, or send contacts to Zapier or Make.', 'subtleforms' ),
			),
			array(
				'slug'        => 'analytics',
				'label'       => __( 'Analytics', 'subtleforms' ),
				'description' => __( 'Views, submissions and conversion rate for every form.', 'subtleforms' ),
			),
			array(
				'slug'        => 'ecommerce',
				'label'       => __( 'WooCommerce', 'subtleforms' ),
				'description' => __( 'Take form payments through the WooCommerce checkout and sell WooCommerce products from any form.', 'subtleforms' ),
			),
			array(
				'slug'        => 'pdf',
				'label'       => __( 'Entry PDF', 'subtleforms' ),
				'description' => __( 'Download any entry as a PDF and attach it to notification emails.', 'subtleforms' ),
			),
			array(
				'slug'        => 'multilanguage',
				'label'       => __( 'Multilanguage', 'subtleforms' ),
				'description' => __( 'Register form strings with WPML or Polylang for full translation support.', 'subtleforms' ),
			),
			array(
				'slug'        => 'payments',
				'label'       => __( 'Payments', 'subtleforms' ),
				'description' => __( 'Accept Stripe or PayPal payments directly through your forms.', 'subtleforms' ),
			),
		);

		$result = array();

		foreach ( $extensions as $meta ) {
			$slug      = $meta['slug'];
			$cap_key   = 'extensions.' . $slug;
			$sk        = 'ext_' . $slug;
			// Webhooks and analytics are part of the free plugin.
			$available = in_array( $slug, array( 'webhooks', 'analytics' ), true ) || $gate->allows( $cap_key );
			$enabled   = (bool) $settings->get( $sk . '_enabled' );
			if ( 'ecommerce' === $slug ) {
				// The WooCommerce integration has no on/off switch: it is on
				// whenever WooCommerce is active.
				$enabled = class_exists( 'WooCommerce' );
			}
			if ( 'webhooks' === $slug || 'pdf' === $slug ) {
				// Webhook actions and entry PDF downloads have no master switch
				// (2.1); their panels only hold defaults.
				$enabled = true;
			}

			// Lightweight check: does the extension have its primary credential set?
			$configured = $this->isExtensionConfigured( $slug, $settings );

			$result[ $slug ] = array(
				'slug'        => $slug,
				'label'       => $meta['label'],
				'description' => $meta['description'],
				'available'   => $available,  // false = needs an add-on (SubtleForms Pro)
				'enabled'     => $enabled && $available,
				'configured'  => $configured,
				/**
				 * The plan an integration this site cannot use yet is part of
				 * (2.4.1), such as "Pro" or "Agency". Empty hides it.
				 *
				 * @param string $plan Plan name.
				 * @param string $slug Integration slug.
				 * @since 2.4.1
				 */
				'requires'    => $available ? '' : sanitize_text_field( (string) apply_filters( 'subtleforms/extensions/requires', '', $slug ) ),
			);
		}

		return $result;
	}

	/**
	 * Rough check whether the critical settings for an extension look populated.
	 */
	private function isExtensionConfigured( string $slug, \SubtleForms\Support\Settings $settings ): bool {
		$checks = array(
			'webhooks'       => array(), // no required key, endpoint can be per-form
			'email_marketing' => array( 'ext_email_marketing_api_key' ),
			'crm'            => array( 'webhook' === $settings->get( 'ext_crm_provider' ) ? 'ext_crm_webhook_url' : 'ext_crm_api_key' ),
			'analytics'      => array(), // no external API needed
			'ecommerce'      => array(), // depends on WooCommerce products
			'pdf'            => array(), // no API key needed
			'multilanguage'  => array(), // no API key needed
			'payments'       => array( 'ext_payments_stripe_pk' ), // either stripe or paypal
		);

		$required = $checks[ $slug ] ?? array();

		foreach ( $required as $key ) {
			if ( ! $settings->get( $key ) ) {
				return false;
			}
		}

		return true;
	}

	private function is_builder_screen( string $hook ): bool {
		$hook = Helpers::normalize_string( $hook );
		if ( strpos( $hook, 'subtleforms-new-form' ) !== false ) {
			return true;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin screen routing.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		return $page === 'subtleforms-new-form';
	}

	public function filter_admin_body_class( $classes ) {
		// Handle different input types (string or array)
		if ( is_array( $classes ) ) {
			$classes = implode( ' ', $classes );
		} elseif ( ! is_string( $classes ) || $classes === null ) {
			$classes = '';
		}

		// Ensure $classes is never null
		$classes = (string) $classes;

		if ( $this->is_builder_screen( $this->currentPage ?: '' ) ) {
			$classes .= ' subtleforms-builder-page';
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Admin page slug; no form data processed.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		// Every SubtleForms screen renders inside the app frame. The class is
		// printed server-side so the frame layout applies before React mounts.
		if ( $page === 'subtleforms' || strpos( $page, 'subtleforms-' ) === 0 ) {
			$classes .= ' subtleforms-admin-page subtleforms-admin-scope';
		}
		if ( $page === 'subtleforms-new-form' && strpos( Helpers::normalize_string( $classes ), 'subtleforms-builder-page' ) === false ) {
			$classes .= ' subtleforms-builder-page';
		}

		return trim( $classes );
	}

	/**
	 * Handle admin actions (delete, duplicate, etc.).
	 */
	public function handle_actions(): void {
		if ( ! isset( $_GET['action'] ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Action key read for routing only; nonce verified below before processing.
		$action = sanitize_key( Helpers::safe_string_get( $_GET, 'action' ) );

		// Only handle SubtleForms-specific admin actions here.
		$allowed = array(
			'delete_form',
			'duplicate_form',
			'delete_submission',
		);

		if ( ! in_array( $action, $allowed, true ) ) {
			return;
		}

		// For our actions, require nonce and validate it.
		// phpcs:disable WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce is validated, not sanitized.
		if ( empty( $_GET['_wpnonce'] ) || ! wp_verify_nonce( wp_unslash( $_GET['_wpnonce'] ), 'subtleforms_action' ) ) {
			wp_die( esc_html__( 'Security check failed.', 'subtleforms' ) );
		// phpcs:enable WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Nonce verified above.
		$id = isset( $_GET['id'] ) ? intval( $_GET['id'] ) : 0;

		switch ( $action ) {
			case 'delete_form':
				$this->handle_delete_form( $id );
				break;
			case 'duplicate_form':
				$this->handle_duplicate_form( $id );
				break;
			case 'delete_submission':
				$this->handle_delete_submission( $id );
				break;
		}
	}

	/**
	 * Render dashboard page.
	 */
	public function render_dashboard(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$stats = $this->get_dashboard_stats();

		$this->get_template( 'dashboard', $stats );
	}

	/**
	 * Render forms list page.
	 */
	public function render_forms(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$forms = $this->formsRepo->all(
			array(
				'limit'   => 50,
				'orderby' => 'updated_at',
				'order'   => 'DESC',
			)
		);

		$this->get_template( 'forms-list', array( 'forms' => $forms ) );
	}

	/**
	 * Render new form page.
	 */
	public function render_new_form(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		// Check if editing an existing form
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Admin URL param; nonce verified separately for write actions.
		$formId = isset( $_GET['form_id'] ) ? intval( $_GET['form_id'] ) : null;
		$form   = null;

		if ( $formId ) {
			$form = $this->formsRepo->find( $formId );
			if ( ! $form ) {
				wp_die( esc_html__( 'Form not found.', 'subtleforms' ) );
			}
		}

		$this->get_template( 'form-editor', array( 'form' => $form ) );
	}

	/**
	 * Render submissions page.
	 */
	public function render_submissions(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Reading URL param for filter display, not processing form data.
		$formId      = isset( $_GET['form_id'] ) ? intval( $_GET['form_id'] ) : null;
		$submissions = $formId
			? $this->submissionsRepo->findByForm( $formId, array( 'limit' => 50 ) )
			: array();

		$forms = $this->formsRepo->all( array( 'limit' => 100 ) );

		$this->get_template(
			'submissions-list',
			array(
				'submissions'   => $submissions,
				'forms'         => $forms,
				'currentFormId' => $formId,
			)
		);
	}

	/**
	 * Render extensions page.
	 */
	public function render_extensions(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$this->get_template( 'extensions' );
	}

	/**
	 * Where the old Tools screen went.
	 *
	 * Tools is a tab of Settings now. The old URL, admin.php?page=subtleforms-tools,
	 * still works: it opens Settings on that tab, so bookmarks and links from
	 * add-ons keep working.
	 *
	 * @return string Admin URL of the Tools tab.
	 */
	public static function tools_tab_url(): string {
		return admin_url( 'admin.php?page=subtleforms-settings#tab=tools' );
	}

	/**
	 * Send the old Tools URL to the Tools tab of Settings.
	 */
	public function redirect_legacy_pages(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Reading the page slug of a navigation request.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		if ( 'subtleforms-tools' !== $page || ! current_user_can( $this->caps->manage_cap() ) ) {
			return;
		}
		wp_safe_redirect( self::tools_tab_url() );
		exit;
	}

	/**
	 * Render reports page.
	 */
	public function render_reports(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}
		$this->get_template( 'reports' );
	}

	public function render_payments(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$this->get_template( 'payments' );
	}

	/**
	 * Render settings page.
	 */
	public function render_settings(): void {
		if ( ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'subtleforms' ) );
		}

		$this->get_template( 'settings' );
	}

	/**
	 * Get dashboard statistics.
	 */
	private function get_dashboard_stats(): array {
		return array(
			'total_forms'        => $this->formsRepo->count(),
			'active_forms'       => $this->formsRepo->count( array( 'status' => 'published' ) ),
			'draft_forms'        => $this->formsRepo->count( array( 'status' => 'draft' ) ),
			'total_submissions'  => $this->submissionsRepo->count(),
			'recent_submissions' => $this->submissionsRepo->count(
				array(
					'status' => 'completed',
				)
			),
		);
	}

	/**
	 * Handle form deletion.
	 */
	private function handle_delete_form( int $id ): void {
		if ( ! $id || ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'Invalid request.', 'subtleforms' ) );
		}

		$this->formsRepo->delete( $id );

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'    => 'subtleforms-forms',
					'message' => 'deleted',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Handle form duplication.
	 */
	private function handle_duplicate_form( int $id ): void {
		if ( ! $id || ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'Invalid request.', 'subtleforms' ) );
		}

		$form = $this->formsRepo->find( $id );
		if ( ! $form ) {
			wp_die( esc_html__( 'Form not found.', 'subtleforms' ) );
		}

		$newId = $this->formsRepo->create(
			array(
				'title'  => $form['title'] . ' (Copy)',
				'config' => $form['config'],
				'status' => 'draft',
			)
		);

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'    => 'subtleforms-forms',
					'message' => 'duplicated',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Handle submission deletion.
	 */
	private function handle_delete_submission( int $id ): void {
		if ( ! $id || ! current_user_can( $this->caps->manage_cap() ) ) {
			wp_die( esc_html__( 'Invalid request.', 'subtleforms' ) );
		}

		$this->submissionsRepo->delete( $id );

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'    => 'subtleforms-submissions',
					'message' => 'deleted',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Get template file path or render inline fallback.
	 */
	private function get_template( string $name, array $data = array() ): void {
		$templatePath = SUBTLEFORMS_PLUGIN_DIR . 'templates/admin/' . $name . '.php';

		if ( file_exists( $templatePath ) ) {
			// $data is available to the template via the local scope.
			include $templatePath;
			return;
		}

		// Inline fallback template
		$this->render_fallback_template( $name, $data );
	}

	/**
	 * Render inline fallback template when file doesn't exist.
	 */
	private function render_fallback_template( string $name, array $data ): void {
		?>
		<div class="wrap subtleforms-admin">
			<h1><?php echo esc_html( ucwords( str_replace( '-', ' ', $name ) ) ); ?></h1>
			
			<?php // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only checking URL param to display success notice, not processing form data. ?>
			<?php if ( isset( $_GET['message'] ) ) : ?>
				<div class="notice notice-success is-dismissible">
					<p><?php esc_html_e( 'Action completed successfully.', 'subtleforms' ); ?></p>
				</div>
			<?php endif; ?>

			<div class="subtleforms-placeholder">
				<div class="subtleforms-placeholder-icon">
					<span class="dashicons dashicons-feedback"></span>
				</div>
				<h2><?php esc_html_e( 'Coming Soon', 'subtleforms' ); ?></h2>
				<p>
					<?php
					/* translators: %s: Name of the interface being developed */
					printf( esc_html__( 'The %s interface is under development.', 'subtleforms' ), '<strong>' . esc_html( $name ) . '</strong>' );
					?>
				</p>
				<p class="description">
					<?php esc_html_e( 'This is a placeholder. Template files will be created in the templates/admin/ directory.', 'subtleforms' ); ?>
				</p>
				
				<?php if ( $name === 'forms-list' && ! empty( $data['forms'] ) ) : ?>
					<div class="subtleforms-quick-list">
						<h3><?php esc_html_e( 'Your Forms', 'subtleforms' ); ?></h3>
						<table class="widefat">
							<thead>
								<tr>
										<th><?php esc_html_e( 'Title', 'subtleforms' ); ?></th>
										<th><?php esc_html_e( 'Status', 'subtleforms' ); ?></th>
										<th><?php esc_html_e( 'Created', 'subtleforms' ); ?></th>
										<th><?php esc_html_e( 'Actions', 'subtleforms' ); ?></th>
								</tr>
							</thead>
							<tbody>
								<?php foreach ( $data['forms'] as $form ) : ?>
									<tr>
										<td><strong><?php echo esc_html( Helpers::safe_array_get( $form, 'title' ) ); ?></strong></td>
										<td><?php echo esc_html( Helpers::safe_array_get( $form, 'status' ) ); ?></td>
										<td><?php echo esc_html( Helpers::safe_array_get( $form, 'created_at' ) ); ?></td>
										<td>
											<a href="
											<?php
											echo esc_url(
												wp_nonce_url(
													add_query_arg(
														array(
															'action' => 'delete_form',
															'id' => Helpers::safe_array_get( $form, 'id', 0 ),
														),
														admin_url( 'admin.php' )
													),
													'subtleforms_action'
												)
											);
											?>
														" class="button button-small"><?php esc_html_e( 'Delete', 'subtleforms' ); ?></a>
										</td>
									</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					</div>
				<?php endif; ?>

				<?php if ( $name === 'dashboard' && isset( $data['total_forms'] ) ) : ?>
					<div class="subtleforms-stats" style="margin-top: 30px;">
						<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 800px; margin: 0 auto;">
							<div class="subtleforms-stat-card" style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 4px;">
								<h3 style="margin: 0 0 10px;"><?php echo esc_html( Helpers::safe_array_get( $data, 'total_forms', 0 ) ); ?></h3>
								<p style="margin: 0; color: #666;"><?php esc_html_e( 'Total Forms', 'subtleforms' ); ?></p>
							</div>
							<div class="subtleforms-stat-card" style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 4px;">
								<h3 style="margin: 0 0 10px;"><?php echo esc_html( Helpers::safe_array_get( $data, 'active_forms', 0 ) ); ?></h3>
								<p style="margin: 0; color: #666;"><?php esc_html_e( 'Active Forms', 'subtleforms' ); ?></p>
							</div>
							<div class="subtleforms-stat-card" style="background: #fff; padding: 20px; border: 1px solid #ccc; border-radius: 4px;">
								<h3 style="margin: 0 0 10px;"><?php echo esc_html( Helpers::safe_array_get( $data, 'total_submissions', 0 ) ); ?></h3>
								<p style="margin: 0; color: #666;"><?php esc_html_e( 'Total Submissions', 'subtleforms' ); ?></p>
							</div>
						</div>
					</div>
				<?php endif; ?>
			</div>
		</div>

		<?php
		exit;
	}

	/**
	 * Filter admin title to ensure proper titles for SubtleForms pages.
	 */
	public function filter_admin_title( $admin_title, $title ): string {
		// Ensure both parameters are strings to prevent deprecation warnings
		$admin_title = Helpers::normalize_string( $admin_title );
		$title       = Helpers::normalize_string( $title );

		// If both are empty, provide a fallback for SubtleForms pages
		if ( empty( $title ) && empty( $admin_title ) ) {
			$current_screen = get_current_screen();
			if ( $current_screen && isset( $current_screen->id ) ) {
				$screen_id = Helpers::normalize_string( $current_screen->id );
				if ( ! empty( $screen_id ) && strpos( $screen_id, 'subtleforms' ) !== false ) {
					return self::branding()['menuName'] . ' &#8212; WordPress';
				}
			}
			return __( 'WordPress Admin', 'subtleforms' );
		}

		// Return admin_title if title is empty, otherwise return admin_title (or fallback)
		if ( empty( $title ) ) {
			return ! empty( $admin_title ) ? $admin_title : __( 'WordPress Admin', 'subtleforms' );
		}

		return ! empty( $admin_title ) ? $admin_title : $title;
	}

	/**
	 * Fix admin global variables to prevent null deprecation warnings.
	 */
	public function fix_admin_globals(): void {
		global $title, $parent_file, $submenu_file;

		// Ensure $title is never null using Helpers
		if ( $title === null || $title === '' ) {
			$current_screen = get_current_screen();
			if ( $current_screen && isset( $current_screen->id ) ) {
				$screen_id = Helpers::normalize_string( $current_screen->id );
				if ( ! empty( $screen_id ) && strpos( $screen_id, 'subtleforms' ) !== false ) {
					$title = __( 'SubtleForms', 'subtleforms' );
				} else {
					$title = '';
				}
			} else {
				$title = '';
			}
		} else {
			// Always ensure $title is a string
			$title = Helpers::normalize_string( $title );
		}

		// Ensure other globals are strings
		if ( $parent_file === null ) {
			$parent_file = '';
		} else {
			$parent_file = Helpers::normalize_string( $parent_file );
		}

		if ( $submenu_file === null ) {
			$submenu_file = '';
		} else {
			$submenu_file = Helpers::normalize_string( $submenu_file );
		}
	}

	/**
	 * Fix parent_file to ensure correct top-level menu highlighting.
	 * 
	 * WordPress needs parent_file to match the top-level menu slug
	 * for all SubtleForms admin pages.
	 *
	 * @param string $parent_file The current parent file.
	 * @return string The corrected parent file.
	 */
	public function fix_parent_file( $parent_file ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin screen routing.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		// For all SubtleForms pages, ensure parent is 'subtleforms'
		if ( ! empty( $page ) && strpos( $page, 'subtleforms' ) === 0 ) {
			return 'subtleforms';
		}

		return $parent_file;
	}

	/**
	 * Fix submenu_file to ensure correct submenu highlighting.
	 * 
	 * This tells WordPress which submenu item should be highlighted as active.
	 * The dashboard page uses 'subtleforms' (same as parent), which WordPress
	 * auto-converts to the first submenu item.
	 *
	 * @param string $submenu_file The current submenu file.
	 * @return string The corrected submenu file.
	 */
	public function fix_submenu_file( $submenu_file ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin screen routing.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		if ( empty( $page ) ) {
			return $submenu_file;
		}

		// Map each page to its correct submenu slug
		// Dashboard uses the parent slug, which WordPress highlights as first submenu
		if ( $page === 'subtleforms' ) {
			return 'subtleforms';
		}

		// The builder reuses the "Add New" slug (subtleforms-new-form) for both
		// creating and editing. When a form_id is present we are editing an
		// existing form, so highlight "All Forms" (where the user came from)
		// rather than "Add New" (Part B18).
		if ( $page === 'subtleforms-new-form' ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check for admin menu highlighting.
			$form_id = isset( $_GET['form_id'] ) ? sanitize_key( wp_unslash( $_GET['form_id'] ) ) : '';
			if ( ! empty( $form_id ) ) {
				return 'subtleforms-forms';
			}
			return 'subtleforms-new-form';
		}

		// All other pages should highlight themselves
		if ( strpos( $page, 'subtleforms' ) === 0 ) {
			return $page;
		}

		return $submenu_file;
	}
}
