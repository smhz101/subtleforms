<?php
/**
 * The SubtleForms item in the WordPress admin bar.
 *
 * Shown on the front end and in the admin to people who can manage SubtleForms
 * entries: the mark, the name and a bubble with the unread entries (styled
 * like the Comments bubble, absent when nothing is unread). Its sub items are
 * Submissions, All Forms and Add New. The count is the one the admin menu
 * badge uses, read once per request.
 *
 * @package SubtleForms\Admin
 * @since   2.7.5
 */

namespace SubtleForms\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\Capabilities;

/**
 * Admin bar node.
 */
final class AdminBar {

	/** Node id. */
	public const NODE = 'subtleforms';

	/**
	 * Hook in.
	 */
	public static function register(): void {
		// Core adds Comments at priority 60; this item follows it.
		add_action( 'admin_bar_menu', array( self::class, 'add_nodes' ), 61 );
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue_styles' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue_styles' ) );
	}

	/**
	 * Whether the current user sees the item.
	 *
	 * @return bool
	 */
	private static function allowed(): bool {
		return is_user_logged_in() && current_user_can( ( new Capabilities() )->manage_cap() );
	}

	/**
	 * Add the item and its children.
	 *
	 * @param \WP_Admin_Bar $bar Admin bar.
	 */
	public static function add_nodes( $bar ): void {
		if ( ! $bar instanceof \WP_Admin_Bar || ! self::allowed() ) {
			return;
		}
		$unread = AdminMenu::unread_count();
		$name   = (string) ( AdminMenu::branding()['menuName'] ?? 'SubtleForms' );

		$title = '<span class="ab-icon" aria-hidden="true"></span><span class="ab-label sf-ab-name">' . esc_html( $name ) . '</span>';
		if ( $unread > 0 ) {
			$label  = number_format_i18n( $unread );
			$title .= '<span class="ab-label awaiting-mod pending-count count-' . (int) min( $unread, 99 ) . '" aria-hidden="true">' . esc_html( $label ) . '</span>'
				. '<span class="screen-reader-text">' . esc_html(
					sprintf(
						/* translators: %s: number of unread entries. */
						_n( '%s unread entry', '%s unread entries', $unread, 'subtleforms' ),
						$label
					)
				) . '</span>';
		}

		$submissions = admin_url( 'admin.php?page=subtleforms-submissions' );
		$bar->add_node(
			array(
				'id'    => self::NODE,
				'title' => $title,
				'href'  => $unread > 0 ? add_query_arg( 'unread', '1', $submissions ) : $submissions,
				'meta'  => array( 'class' => 'sf-admin-bar' ),
			)
		);

		$count_suffix = $unread > 0 ? ' <span class="sf-ab-count">' . esc_html( number_format_i18n( $unread ) ) . '</span>' : '';
		$bar->add_node(
			array(
				'parent' => self::NODE,
				'id'     => self::NODE . '-submissions',
				'title'  => esc_html__( 'Submissions', 'subtleforms' ) . $count_suffix,
				'href'   => $submissions,
			)
		);
		$bar->add_node(
			array(
				'parent' => self::NODE,
				'id'     => self::NODE . '-forms',
				'title'  => esc_html__( 'All Forms', 'subtleforms' ),
				'href'   => admin_url( 'admin.php?page=subtleforms-forms' ),
			)
		);
		$bar->add_node(
			array(
				'parent' => self::NODE,
				'id'     => self::NODE . '-new',
				'title'  => esc_html__( 'Add New', 'subtleforms' ),
				'href'   => admin_url( 'admin.php?page=subtleforms-new-form' ),
			)
		);
	}

	/**
	 * Style for the mark and the bubble, on the front end and in the admin.
	 */
	public static function enqueue_styles(): void {
		if ( ! is_admin_bar_showing() || ! self::allowed() ) {
			return;
		}
		$mark = AdminMenu::default_menu_icon();
		$css  = '#wpadminbar #wp-admin-bar-subtleforms .ab-icon{float:left;width:22px!important;height:32px!important;margin-inline-end:2px;}'
			. '#wpadminbar #wp-admin-bar-subtleforms .ab-icon::before{content:"";display:block;width:20px;height:20px;margin-top:6px;background:currentColor;'
			. '-webkit-mask:url("' . $mark . '") center/contain no-repeat;mask:url("' . $mark . '") center/contain no-repeat;}'
			. '#wpadminbar #wp-admin-bar-subtleforms:hover .ab-icon::before{color:#72aee6;}'
			. '#wpadminbar #wp-admin-bar-subtleforms .awaiting-mod{display:inline-block;box-sizing:border-box;min-width:18px;height:18px;margin:7px 0 0 6px;padding:0 5px;border-radius:9px;background:#d63638;color:#fff;font-size:11px;line-height:1.6;text-align:center;}'
			. '#wpadminbar #wp-admin-bar-subtleforms .sf-ab-count{display:inline-block;min-width:18px;margin-inline-start:4px;padding:0 5px;border-radius:9px;background:#d63638;color:#fff;font-size:11px;line-height:18px;text-align:center;}'
			. '@media screen and (max-width:782px){#wpadminbar #wp-admin-bar-subtleforms{display:block;}#wpadminbar #wp-admin-bar-subtleforms .sf-ab-name{display:none;}'
			. '#wpadminbar #wp-admin-bar-subtleforms .ab-icon{width:52px!important;height:46px!important;text-align:center;}#wpadminbar #wp-admin-bar-subtleforms .ab-icon::before{width:26px;height:26px;margin:10px auto 0;}'
			. '#wpadminbar #wp-admin-bar-subtleforms .awaiting-mod{position:absolute;top:2px;inset-inline-start:26px;margin:0;}}';
		wp_register_style( 'subtleforms-admin-bar', false, array(), SUBTLEFORMS_VERSION );
		wp_enqueue_style( 'subtleforms-admin-bar' );
		wp_add_inline_style( 'subtleforms-admin-bar', $css );
	}
}
