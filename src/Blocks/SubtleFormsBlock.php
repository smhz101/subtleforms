<?php


/**
 * SubtleForms Block Registration
 *
 * Handles server-side registration of the subtleforms/form Gutenberg block.
 *
 * @package SubtleForms
 * @since 1.5.0
 */

namespace SubtleForms\Blocks;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Registers and manages the SubtleForms Gutenberg block.
 */
final class SubtleFormsBlock {

	/**
	 * Initialize block registration hooks.
	 */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register_block' ) );
		add_action( 'enqueue_block_editor_assets', array( self::class, 'enqueue_editor_assets' ) );
	}

	/**
	 * Register the subtleforms/form block.
	 */
	public static function register_block(): void {
		// Block metadata and editor assets are handled by block.json
		register_block_type(
			SUBTLEFORMS_PLUGIN_DIR . 'build/blocks/form',
			array(
				'render_callback' => array( self::class, 'render_block' ),
			)
		);
	}

	/**
	 * Render the block on the frontend.
	 *
	 * This outputs the minimal placeholder markup that frontend.js will detect
	 * and hydrate with the actual form renderer.
	 *
	 * @param array  $attributes Block attributes
	 * @param string $content Block inner content (empty for this block)
	 * @return string Rendered block HTML
	 */
	public static function render_block( array $attributes, string $content = '' ): string {
		$form_id = $attributes['formId'] ?? 0;

		if ( ! $form_id ) {
			return '';
		}

		// Verify form exists and is published (security check)
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_forms';
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
		$form  = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id, status FROM {$table} WHERE id = %d",
				$form_id
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// If form doesn't exist or isn't published, render nothing
		if ( ! $form || $form->status !== 'published' ) {
			// In admin/preview, show message; on frontend, fail silently
			if ( is_admin() || is_preview() ) {
				return sprintf(
					'<div class="subtleforms-block-error" style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">%s</div>',
					esc_html__( 'This form is not available or has been unpublished.', 'subtleforms' )
				);
			}
			return '';
		}

		// Login, schedule and entry-limit rules (2.0).
		$blocked = \SubtleForms\Engine\FormRestrictions::blockedReason( (int) $form_id, \SubtleForms\Engine\FormRestrictions::activeSchema( (int) $form_id ) );
		if ( $blocked !== null ) {
			self::enqueue_frontend_assets();
			return \SubtleForms\Engine\FormRestrictions::render( $blocked );
		}

		// Build CSS classes
		$classes = array( 'subtleforms-block' );

		if ( ! empty( $attributes['align'] ) ) {
			$classes[] = 'align' . esc_attr( $attributes['align'] );
		}

		if ( ! empty( $attributes['className'] ) ) {
			$classes[] = esc_attr( $attributes['className'] );
		}

		// The renderer is what turns the placeholder below into a form, so it is
		// enqueued here rather than from a hook that has to guess where blocks
		// appear. A block in a template part or a widget area is rendered the
		// same way as one in post content, and now gets its assets the same way
		// too.
		self::enqueue_frontend_assets();

		// Block options are forwarded to the frontend renderer as data
		// attributes so the form renders with the user's chosen theme, title
		// visibility, AJAX mode, tab index and prefilled field values.
		$show_title     = isset( $attributes['showTitle'] ) ? (bool) $attributes['showTitle'] : true;
		$show_desc      = isset( $attributes['showDescription'] ) ? (bool) $attributes['showDescription'] : true;
		$theme          = isset( $attributes['theme'] ) ? $attributes['theme'] : 'default';
		$ajax           = isset( $attributes['ajax'] ) ? (bool) $attributes['ajax'] : false;
		$tab_index      = isset( $attributes['tabIndex'] ) ? (int) $attributes['tabIndex'] : 0;
		$field_values   = isset( $attributes['fieldValues'] ) ? (string) $attributes['fieldValues'] : '';

		return sprintf(
			'<div class="%s" data-form-id="%d" data-show-title="%d" data-show-description="%d" data-theme="%s" data-ajax="%d" data-tabindex="%d" data-field-values="%s"></div>',
			esc_attr( implode( ' ', $classes ) ),
			esc_attr( $form_id ),
			$show_title ? 1 : 0,
			$show_desc ? 1 : 0,
			esc_attr( $theme ),
			$ajax ? 1 : 0,
			$tab_index,
			esc_attr( $field_values )
		);
	}

	/**
	 * Enqueue the frontend renderer for a rendered block.
	 *
	 * Shared with the shortcode so a form behaves identically however it is
	 * embedded — same script, same styles, same configured messages.
	 */
	private static function enqueue_frontend_assets(): void {
		if ( is_admin() ) {
			return;
		}

		$settings = null;
		$captcha  = null;

		// Settings and CAPTCHA are optional here: without them the bundle still
		// loads with the built-in messages, which is better than a fatal on a
		// visitor-facing page if the container is not built yet.
		try {
			$container = \SubtleForms\Plugin::instance()->container();

			if ( $container->has( \SubtleForms\Support\Settings::class ) ) {
				$settings = $container->get( \SubtleForms\Support\Settings::class );
			}

			if ( $container->has( \SubtleForms\Support\Captcha\CaptchaManager::class ) ) {
				$captcha = $container->get( \SubtleForms\Support\Captcha\CaptchaManager::class );
			}
		} catch ( \Throwable $e ) {
			$settings = null;
			$captcha  = null;
		}

		\SubtleForms\Frontend\FrontendAssets::enqueue( $settings, $captcha );
	}

	/**
	 * Enqueue assets needed in block editor.
	 *
	 * The frontend renderer is needed for live preview in the editor.
	 */
	public static function enqueue_editor_assets(): void {
		// Load asset file with proper dependencies
		$asset_file = include SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/frontend.asset.php';

		// Enqueue frontend renderer for block preview
		wp_enqueue_script(
			'subtleforms-frontend-preview',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		wp_enqueue_style(
			'subtleforms-frontend-preview',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
			array(),
			SUBTLEFORMS_VERSION
		);

		// Pass REST URL and nonce for block editor
		wp_localize_script(
			'subtleforms-frontend-preview',
			'subtleformsAdmin',
			array(
				'restUrl' => rest_url( 'subtleforms/v1/' ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);
	}

}
