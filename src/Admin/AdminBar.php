<?php
/**
 * The SubtleForms item in the WordPress admin bar.
 *
 * Shown on the front end and in the admin to people who can manage SubtleForms
 * entries: the mark, the name and a bubble with the unread entries (styled
 * like the Comments bubble, absent when nothing is unread). Its sub items are
 * Submissions, All Forms, Add New and, while no add-on is active, the
 * Upgrade item. The count is the one the admin menu badge uses, read once per request.
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
				'href'  => $unread > 0 ? add_query_arg( 'tab', 'unread', $submissions ) : $submissions,
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
		// Last, under the same condition as the menu entry.
		if ( AdminMenu::show_upgrade_item() ) {
			$bar->add_node(
				array(
					'parent' => self::NODE,
					'id'     => self::NODE . '-upgrade',
					'title'  => '<span class="sf-ab-upgrade">' . AdminMenu::upgrade_label() . '</span>',
					'href'   => admin_url( 'admin.php?page=' . AdminMenu::UPGRADE_SLUG ),
				)
			);
		}
	}

	/**
	 * Style for the mark and the bubble, on the front end and in the admin.
	 */
	public static function enqueue_styles(): void {
		if ( ! is_admin_bar_showing() || ! self::allowed() ) {
			return;
		}
		$mark = AdminMenu::default_menu_icon();
		$node = '#wpadminbar #wp-admin-bar-subtleforms';
		// The icon box is core's: .ab-icon keeps its float, its 4px vertical padding and
		// font metrics, so it is 20 by 20 inside that padding with the same 6px gap as
		// the Comments item. The mark is a mask filled with currentColor, which core
		// colours per scheme and on hover, like the dashicons of the other items.
		$css = $node . ' .ab-icon{width:20px;height:20px;margin-inline-end:6px;}'
			. $node . ' .ab-icon::before{content:"";display:block;position:relative;top:2px;width:20px;height:20px;background:currentColor;'
			. '-webkit-mask:url("' . $mark . '") center/contain no-repeat;mask:url("' . $mark . '") center/contain no-repeat;}'
			. $node . ' .awaiting-mod,' . $node . ' .sf-ab-count{box-sizing:border-box;border-radius:9px;background:#d63638;color:#fff;text-align:center;}'
			. $node . ' .awaiting-mod{display:inline-block;min-width:18px;height:18px;margin:7px 0 0 6px;padding:0 5px;font-size:11px;line-height:1.6;}'
			. $node . ' .sf-ab-count{display:inline-block;min-width:18px;margin-inline-start:4px;padding:0 5px;font-size:11px;line-height:18px;}'
			// Hover and focus turn the item text blue, never the bubble.
			. '#wpadminbar:not(.mobile)>#wp-toolbar #wp-admin-bar-subtleforms:hover .awaiting-mod,#wpadminbar>#wp-toolbar #wp-admin-bar-subtleforms.hover .awaiting-mod,'
			. '#wpadminbar:not(.mobile)>#wp-toolbar #wp-admin-bar-subtleforms a:focus .awaiting-mod,#wpadminbar #wp-admin-bar-subtleforms li:hover .sf-ab-count,'
			. '#wpadminbar #wp-admin-bar-subtleforms li a:hover .sf-ab-count,#wpadminbar #wp-admin-bar-subtleforms li a:focus .sf-ab-count{color:#fff;background:#d63638;}'
			// The upgrade item: the brand colour and star of the menu entry.
			. $node . ' .sf-ab-upgrade{color:#8fa3ff;font-weight:600;}'
			. $node . ' .sf-ab-upgrade::before{content:"\\f155";font:normal 13px/1 dashicons;margin-inline-end:5px;vertical-align:-1px;}'
			. $node . ' a:hover .sf-ab-upgrade,' . $node . ' a:focus .sf-ab-upgrade{color:#fff;}'
			. 'body.admin-color-light ' . $node . ' .sf-ab-upgrade{color:#3858e9;}'
			. '@media screen and (max-width:782px){' . $node . '{display:block;}' . $node . ' .sf-ab-name{display:none;}'
			. $node . ' .ab-icon{width:52px!important;height:46px!important;margin:0;text-align:center;}' . $node . ' .ab-icon::before{width:26px;height:26px;top:0;margin:10px auto 0;}'
			. $node . ' .awaiting-mod{position:absolute;top:2px;inset-inline-start:26px;margin:0;}}';
		wp_register_style( 'subtleforms-admin-bar', false, array(), SUBTLEFORMS_VERSION );
		wp_enqueue_style( 'subtleforms-admin-bar' );
		wp_add_inline_style( 'subtleforms-admin-bar', $css );
	}
}
