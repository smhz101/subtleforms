<?php
/**
 * Notes for a form embed that cannot show its form (2.10.0).
 *
 * Visitors see no change: they get the same output as before for a missing,
 * unpublished or id-less embed, so nothing reveals which forms exist. People
 * who can manage forms get a short note that says what is wrong. Forms that
 * do render also carry a message for visitors who have JavaScript turned off.
 *
 * @package SubtleForms
 * @since   2.10.0
 */

namespace SubtleForms\Frontend;

defined( 'ABSPATH' ) || exit;

use SubtleForms\Support\Capabilities;

/**
 * Builds the admin note and the no-JavaScript message.
 */
final class EmbedNotice {

	public const MISSING     = 'missing';
	public const UNPUBLISHED = 'unpublished';
	public const NO_ID       = 'no_id';

	/** Whether the note stylesheet was printed on this page. */
	private static bool $cssPrinted = false;

	/** Whether the current user may see the notes. */
	public static function canSee(): bool {
		return is_user_logged_in() && current_user_can( ( new Capabilities() )->manage_cap() );
	}

	/**
	 * The note for a broken embed.
	 *
	 * @param string $reason  One of the reason constants.
	 * @param int    $formId  Form ID from the embed, 0 when there is none.
	 * @return string Markup, with the stylesheet the first time.
	 */
	public static function render( string $reason, int $formId ): string {
		if ( self::NO_ID === $reason ) {
			$first = esc_html__( 'SubtleForms: this embed has no valid form ID. Use [subtleforms id="123"] or pick a form in the block.', 'subtleforms' );
		} elseif ( self::UNPUBLISHED === $reason ) {
			$first = esc_html(
				sprintf(
					/* translators: %d: form ID */
					__( 'SubtleForms: form #%d is not published, so visitors do not see it.', 'subtleforms' ),
					$formId
				)
			) . ' <a href="' . esc_url( admin_url( 'admin.php?page=subtleforms-new-form&form_id=' . $formId ) ) . '">'
				. esc_html__( 'Open the form', 'subtleforms' ) . '</a>';
		} else {
			$first = esc_html(
				sprintf(
					/* translators: %d: form ID */
					__( 'SubtleForms: form #%d was not found. It may have been deleted, or this page came from another site.', 'subtleforms' ),
					$formId
				)
			);
		}
		return self::style()
			. '<div class="subtleforms-embed-note" role="note"><p>' . $first . '</p>'
			. '<p class="subtleforms-embed-note__hint">' . esc_html__( 'Only people who can manage forms see this note.', 'subtleforms' ) . '</p></div>';
	}

	/**
	 * A plain note in the same box, for a person without the capability in a
	 * preview.
	 *
	 * @param string $message Message text.
	 */
	public static function plain( string $message ): string {
		return self::style() . '<div class="subtleforms-embed-note" role="note"><p>' . esc_html( $message ) . '</p></div>';
	}

	/**
	 * The no-JavaScript message and the rules that stop a form that cannot
	 * be drawn from holding space or showing a loading outline.
	 *
	 * @param int $formId Form ID of the container.
	 */
	public static function noscript( int $formId ): string {
		$sel = '[data-form-id="' . $formId . '"]';
		return '<noscript><style>'
			. '.subtleforms-form-container' . $sel . ',.subtleforms-block' . $sel . '{min-height:0!important}'
			. '.subtleforms-form-container' . $sel . ' .subtleforms-skeleton,.subtleforms-block' . $sel . ' .subtleforms-skeleton{display:none!important}'
			. self::noscriptCss()
			. '</style><p class="subtleforms-noscript">'
			. esc_html__( 'This form needs JavaScript. Turn it on in your browser to fill it in.', 'subtleforms' )
			. '</p></noscript>';
	}

	/** Rules for the note, printed once per page (the form stylesheet is not loaded for a broken embed). */
	private static function style(): string {
		if ( self::$cssPrinted ) {
			return '';
		}
		self::$cssPrinted = true;
		return '<style id="subtleforms-embed-note-css">' . self::noteCss() . '</style>';
	}

	private static function noteCss(): string {
		$box = 'padding:12px 16px;border-radius:4px;font:inherit;font-size:14px;line-height:1.5;margin:0 0 16px;';
		return '.subtleforms-embed-note{' . $box . 'border:1px solid #dba617;background:#fcf9e8;color:#1d2327}'
			. '.subtleforms-embed-note p{margin:0}'
			. '.subtleforms-embed-note p+p{margin-top:6px}'
			. '.subtleforms-embed-note .subtleforms-embed-note__hint{font-size:12px;color:#646970}';
	}

	private static function noscriptCss(): string {
		return '.subtleforms-noscript{padding:12px 16px;border-radius:4px;font:inherit;font-size:14px;line-height:1.5;margin:0 0 16px;border:1px solid #c3c4c7;background:#f6f7f7;color:#1d2327}';
	}

	/** Forget what was printed (tests). */
	public static function resetForTests(): void {
		self::$cssPrinted = false;
	}
}
