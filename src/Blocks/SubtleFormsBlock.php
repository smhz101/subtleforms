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

	/** Handle of the small script that carries the editor settings and loads the preview. */
	private const LOADER_HANDLE = 'subtleforms-block-editor-loader';

	/**
	 * Initialize block registration hooks.
	 */
	public static function init(): void {
		add_action( 'init', array( self::class, 'register_block' ) );
		add_action( 'enqueue_block_editor_assets', array( self::class, 'enqueue_editor_assets' ) );
		add_action( 'enqueue_block_assets', array( self::class, 'enqueue_canvas_styles' ) );
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

		if ( class_exists( '\WP_Block_Type_Registry' ) ) {
			$block = \WP_Block_Type_Registry::get_instance()->get_registered( 'subtleforms/form' );
			$handles = array();
			if ( $block ) {
				foreach ( array( 'editor_script', 'script', 'view_script' ) as $prop ) {
					$value = $block->$prop ?? null;
					if ( is_string( $value ) && '' !== $value ) {
						$handles[] = $value;
					} elseif ( is_array( $value ) ) {
						foreach ( $value as $handle ) {
							if ( is_string( $handle ) && '' !== $handle ) {
								$handles[] = $handle;
							}
						}
					}
				}
			}
			foreach ( array_unique( $handles ) as $handle ) {
				wp_set_script_translations( $handle, 'subtleforms', SUBTLEFORMS_PLUGIN_DIR . 'languages' );
			}
		}
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
	/**
	 * Classes shared with the shortcode so both use the same width.
	 *
	 * @return string[]
	 */
	public static function wrapperClasses(): array {
		return array( 'subtleforms-block', 'subtleforms-form-container' );
	}

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
			self::enqueue_frontend_assets( (int) $form_id );
			return \SubtleForms\Engine\FormRestrictions::render( $blocked );
		}

		// Build CSS classes
		$classes = self::wrapperClasses();

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
		self::enqueue_frontend_assets( (int) $form_id );

		// Block options are forwarded to the frontend renderer as data
		// attributes so the form renders with the user's chosen theme, title
		// visibility, AJAX mode, tab index and prefilled field values.
		$show_title     = isset( $attributes['showTitle'] ) ? (bool) $attributes['showTitle'] : true;
		$show_desc      = isset( $attributes['showDescription'] ) ? (bool) $attributes['showDescription'] : true;
		$theme          = isset( $attributes['theme'] ) ? $attributes['theme'] : 'default';
		$ajax           = isset( $attributes['ajax'] ) ? (bool) $attributes['ajax'] : false;
		$tab_index      = isset( $attributes['tabIndex'] ) ? (int) $attributes['tabIndex'] : 0;
		$field_values   = isset( $attributes['fieldValues'] ) ? (string) $attributes['fieldValues'] : '';

		// A post of this form without AJAX just returned here: hand its outcome
		// to the renderer (2.4.0).
		$classic = $ajax ? null : \SubtleForms\Api\ClassicResult::forForm( (int) $form_id );

		// Kept at the estimated height of the form so the page does not jump
		// when the form appears (UX2-27).
		$schema  = \SubtleForms\Engine\FormRestrictions::activeSchema( (int) $form_id );
		$schema  = is_array( $schema ) ? $schema : null;
		$reserve = \SubtleForms\Frontend\FormPlaceholder::attributes( $schema, $show_title, $show_desc )
			. \SubtleForms\Frontend\Shortcode::featuresAttribute( $schema );

		$inline = \SubtleForms\Frontend\Shortcode::inlineParts( (int) $form_id, $schema, $show_title, $show_desc );
		\SubtleForms\Frontend\FrontendAssets::preloadFieldCode( $schema );
		\SubtleForms\Frontend\FrontendAssets::loadFieldTranslations( $schema );
		return sprintf(
			'<div class="%s" data-form-id="%d" data-show-title="%d" data-show-description="%d" data-theme="%s" data-ajax="%d" data-tabindex="%d" data-field-values="%s"%s%s>%s</div>%s',
			esc_attr( implode( ' ', $classes ) ),
			esc_attr( $form_id ),
			$show_title ? 1 : 0,
			$show_desc ? 1 : 0,
			esc_attr( $theme ),
			$ajax ? 1 : 0,
			$tab_index,
			esc_attr( $field_values ),
			null === $classic ? '' : ' data-classic-result="' . esc_attr( (string) wp_json_encode( $classic ) ) . '"',
			$reserve,
			$inline['outline'],
			$inline['tag']
		);
	}

	/**
	 * Enqueue the frontend renderer for a rendered block.
	 *
	 * Shared with the shortcode so a form behaves identically however it is
	 * embedded, same script, same styles, same configured messages.
	 */
	private static function enqueue_frontend_assets( int $formId = 0 ): void {
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

		$providers = array();
		if ( $formId > 0 ) {
			$schema = \SubtleForms\Engine\FormRestrictions::activeSchema( $formId );
			if ( is_array( $schema ) ) {
				foreach ( \SubtleForms\Support\Captcha\FieldCaptcha::fields( $schema ) as $field ) {
					$provider = \SubtleForms\Support\Captcha\FieldCaptcha::provider( $field );
					if ( '' !== $provider ) {
						$providers[] = $provider;
					}
				}
			}
		}

		\SubtleForms\Frontend\FrontendAssets::enqueue( $settings, $captcha, $providers );
	}

	/**
	 * The form stylesheet, inside the editor canvas (2.6.1).
	 *
	 * The editor draws blocks in an iframe (WordPress 6.3 and later), and a
	 * style enqueued on enqueue_block_editor_assets only reaches the editor
	 * around it, so the preview was drawn without the form's styles. Styles
	 * enqueued on enqueue_block_assets are the ones copied into the canvas, so
	 * the preview gets the same stylesheet the site loads. Every rule in it is
	 * scoped to the form's own classes, so it does not touch the editor itself.
	 */
	public static function enqueue_canvas_styles(): void {
		if ( ! is_admin() ) {
			return;
		}
		// Only on the screens that draw blocks (post, site and widget editors).
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ! method_exists( $screen, 'is_block_editor' ) || ! $screen->is_block_editor() ) {
			return;
		}
		wp_enqueue_style(
			'subtleforms-frontend-preview',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
			array(),
			SUBTLEFORMS_VERSION
		);
		wp_style_add_data( 'subtleforms-frontend-preview', 'rtl', 'replace' );
	}

	/**
	 * Enqueue assets needed in block editor.
	 *
	 * The frontend renderer is needed for live preview in the editor. Its
	 * stylesheet goes into the canvas (enqueue_canvas_styles).
	 */
	public static function enqueue_editor_assets(): void {
		// Load asset file with proper dependencies
		$asset_file = include SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/frontend.asset.php';
		$src        = SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js';

		// REST address and nonce for the block, always present, because the
		// form list in the block settings needs them even before the preview
		// script has loaded.
		wp_register_script( self::LOADER_HANDLE, false, array( 'wp-data', 'wp-dom-ready' ), SUBTLEFORMS_VERSION, true );
		wp_enqueue_script( self::LOADER_HANDLE );
		wp_localize_script(
			self::LOADER_HANDLE,
			'subtleformsAdmin',
			array(
				'restUrl' => rest_url( 'subtleforms/v1/' ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);

		// The 113 KB renderer is the live preview of a form block. A post that
		// has the block gets it at once (and so do the site editor and widget
		// screens, where the content is not known here); on any other post it
		// loads when the block is first inserted or the inserter opens (2.7.1).
		$post     = get_post();
		$has_form = ! $post instanceof \WP_Post || has_block( 'subtleforms/form', $post );
		if ( $has_form ) {
			wp_enqueue_script(
				'subtleforms-frontend-preview',
				$src,
				$asset_file['dependencies'],
				$asset_file['version'],
				true
			);
			wp_set_script_translations( 'subtleforms-frontend-preview', 'subtleforms', SUBTLEFORMS_PLUGIN_DIR . 'languages' );
			return;
		}

		wp_add_inline_script(
			self::LOADER_HANDLE,
			'( function () {'
			. 'var src = ' . wp_json_encode( add_query_arg( 'ver', (string) $asset_file['version'], $src ) ) . ', started = false;'
			. 'function load() { if ( started ) { return; } started = true; var s = document.createElement( "script" ); s.src = src; document.head.appendChild( s ); }'
			. 'function hasBlock( blocks ) { return blocks.some( function ( b ) { return b.name === "subtleforms/form" || hasBlock( b.innerBlocks || [] ); } ); }'
			. 'function inserterOpen() { try { var ed = wp.data.select( "core/editor" ), ep = wp.data.select( "core/edit-post" );'
			. ' return !! ( ( ed && ed.isInserterOpened && ed.isInserterOpened() ) || ( ep && ep.isInserterOpened && ep.isInserterOpened() ) ); } catch ( e ) { return false; } }'
			. 'wp.domReady( function () { var stop = wp.data.subscribe( function () { var be = wp.data.select( "core/block-editor" );'
			. ' if ( be && ( hasBlock( be.getBlocks() ) || inserterOpen() ) ) { load(); if ( stop ) { stop(); } } } ); } );'
			. '} )();'
		);
	}
}
