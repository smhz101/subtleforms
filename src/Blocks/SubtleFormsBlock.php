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
		add_action( 'enqueue_block_assets', array( self::class, 'enqueue_frontend_assets' ) );
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

		// Build CSS classes
		$classes = array( 'subtleforms-block' );

		if ( ! empty( $attributes['align'] ) ) {
			$classes[] = 'align' . esc_attr( $attributes['align'] );
		}

		if ( ! empty( $attributes['className'] ) ) {
			$classes[] = esc_attr( $attributes['className'] );
		}

		// Output minimal placeholder markup
		// Frontend JS will detect this and mount the renderer
		return sprintf(
			'<div class="%s" data-form-id="%d"></div>',
			esc_attr( implode( ' ', $classes ) ),
			esc_attr( $form_id )
		);
	}

	/**
	 * Enqueue frontend assets when block is present.
	 *
	 * This ensures the frontend renderer is available to hydrate blocks.
	 */
	public static function enqueue_frontend_assets(): void {
		// Only enqueue on frontend (not in editor)
		if ( is_admin() ) {
			return;
		}

		// Check if the current post/page contains the subtleforms/form block
		if ( ! self::has_subtleforms_block() ) {
			return;
		}

		// Load asset file with proper dependencies
		$asset_file = include SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/frontend.asset.php';

		// Enqueue the same frontend bundle used by shortcodes
		wp_enqueue_script(
			'subtleforms-frontend',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		wp_enqueue_style(
			'subtleforms-frontend',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
			array(),
			SUBTLEFORMS_VERSION
		);

		// Pass REST URL and nonce to frontend
		wp_localize_script(
			'subtleforms-frontend',
			'subtleformsFrontend',
			array(
				'restUrl' => rest_url( 'subtleforms/v1/' ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);
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

	/**
	 * Check if the current post/page contains a subtleforms/form block.
	 *
	 * @return bool True if block is present
	 */
	private static function has_subtleforms_block(): bool {
		// Check if we're viewing a singular post
		if ( ! is_singular() ) {
			return false;
		}

		$post = get_post();
		if ( ! $post ) {
			return false;
		}

		// Check if post content contains the block
		return has_block( 'subtleforms/form', $post );
	}
}
