<?php
/**
 * SubtleForms Spam Protection
 *
 * @package   SubtleForms\Engine
 * @version   1.5.0
 */

namespace SubtleForms\Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\SubmissionContext;

/**
 * Handles spam protection mechanisms including Honeypot.
 *
 * @since 1.5.0
 */
final class SpamProtection {

	/**
	 * Honeypot field name (intentionally generic to avoid detection).
	 *
	 * @var string
	 */
	const HONEYPOT_FIELD = 'website_url';

	/**
	 * Time trap field name (measures time to submit).
	 *
	 * @var string
	 */
	const TIME_FIELD = 'form_rendered_at';

	/**
	 * Minimum seconds required before form submission (prevents instant bot submissions).
	 * This is now sourced from settings; the constant serves as a fallback.
	 *
	 * @var int
	 */
	const MIN_SUBMISSION_TIME = 3;

	/**
	 * Check if submission appears to be spam: the honeypot (when switched on)
	 * and the time trap (when a minimum time is set). They are independent.
	 *
	 * @param SubmissionContext $context Submission context containing form data.
	 * @return bool True if spam detected, false otherwise.
	 */
	public static function is_spam( SubmissionContext $context ): bool {
		$data = $context->payload;

		// Check 1: Honeypot field should be empty
		if ( self::check_honeypot( $data ) ) {
			$context->setMeta( 'spam_reason', 'honeypot_filled' );
			return true;
		}

		// Check 2: Time trap - submission should not be instant
		$reason = self::time_trap_reason( $data, (int) $context->formId );
		if ( null !== $reason ) {
			$context->setMeta( 'spam_reason', $reason );
			return true;
		}

		return false;
	}

	/**
	 * A signed time token for a form, issued by the server when the form is
	 * loaded. The time comes from the server clock, so a visitor whose device
	 * clock is wrong is not mistaken for a bot (FF-11), and a bot cannot make
	 * one up (FF-12).
	 *
	 * @param int      $form_id Form ID.
	 * @param int|null $time    Issue time (default now).
	 * @return string Token: v1.<time>.<form id>.<signature>.
	 */
	public static function issue_token( int $form_id, ?int $time = null ): string {
		$time = null === $time ? time() : $time;
		return 'v1.' . $time . '.' . $form_id . '.' . self::sign( $time, $form_id );
	}

	/**
	 * The issue time of a valid token for this form, or null.
	 *
	 * @param mixed $token   Token from the submission.
	 * @param int   $form_id Form ID.
	 * @return int|null
	 */
	public static function token_time( $token, int $form_id ): ?int {
		if ( ! is_string( $token ) || 1 !== preg_match( '/^v1\.(\d{9,11})\.(\d+)\.([a-f0-9]{32})$/', $token, $m ) ) {
			return null;
		}
		$time = (int) $m[1];
		if ( (int) $m[2] !== $form_id || ! hash_equals( self::sign( $time, $form_id ), $m[3] ) ) {
			return null;
		}
		return $time;
	}

	/**
	 * Signature for a token.
	 */
	private static function sign( int $time, int $form_id ): string {
		return substr( hash_hmac( 'sha256', $time . '|' . $form_id, wp_salt( 'nonce' ) ), 0, 32 );
	}

	/**
	 * The minimum seconds between loading a form and sending it (0: off).
	 */
	public static function min_seconds(): int {
		$settings = get_option( 'subtleforms_settings', array() );
		return isset( $settings['min_submission_time'] ) ? max( 0, (int) $settings['min_submission_time'] ) : self::MIN_SUBMISSION_TIME;
	}

	/**
	 * Check if honeypot field was filled (indicates bot).
	 *
	 * @param array $data Form submission data.
	 * @return bool True if honeypot was filled.
	 */
	private static function check_honeypot( array $data ): bool {
		// Check if honeypot is enabled in settings
		$settings = get_option( 'subtleforms_settings', array() );
		$enabled  = isset( $settings['enable_honeypot'] ) ? (bool) $settings['enable_honeypot'] : true;

		if ( ! $enabled ) {
			return false; // Honeypot disabled
		}

		if ( ! isset( $data[ self::HONEYPOT_FIELD ] ) ) {
			return false; // Field not present, skip check.
		}

		$value = $data[ self::HONEYPOT_FIELD ];

		// If honeypot has any value, it's spam
		return ! empty( $value );
	}

	/**
	 * Why the time trap rejects a submission, or null when it passes.
	 *
	 * A missing or forged token is spam, so a bot cannot skip the trap by
	 * leaving the field out (FF-12).
	 *
	 * @param array $data    Form submission data.
	 * @param int   $form_id Form ID.
	 * @return string|null Reason, or null.
	 */
	public static function time_trap_reason( array $data, int $form_id ): ?string {
		$min_time = self::min_seconds();
		if ( $min_time <= 0 ) {
			return null;
		}

		$issued = self::token_time( $data[ self::TIME_FIELD ] ?? null, $form_id );
		if ( null === $issued ) {
			return 'time_token_missing';
		}

		return ( time() - $issued ) < $min_time ? 'submission_too_fast' : null;
	}

	/**
	 * Get honeypot field HTML for injecting into forms.
	 *
	 * @param int $form_id Form ID for unique field naming.
	 * @return string HTML for honeypot and time trap fields.
	 */
	public static function get_honeypot_html( int $form_id ): string {
		$honeypot_name = self::HONEYPOT_FIELD;
		$time_name     = self::TIME_FIELD;
		$current_time  = time();

		$html = sprintf(
			'<div class="subtleforms-hp" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true" tabindex="-1">
				<label for="subtleforms_hp_%1$d">%2$s</label>
				<input type="text" id="subtleforms_hp_%1$d" name="%3$s" value="" autocomplete="off" tabindex="-1" />
				<input type="hidden" name="%4$s" value="%5$s" />
			</div>',
			absint( $form_id ),
			esc_html__( 'Leave this field empty', 'subtleforms' ),
			esc_attr( $honeypot_name ),
			esc_attr( $time_name ),
			esc_attr( self::issue_token( $form_id, $current_time ) )
		);

		return $html;
	}

	/**
	 * Check if honeypot protection is enabled globally.
	 *
	 * @return bool True if enabled.
	 */
	public static function is_enabled(): bool {
		$settings = get_option( 'subtleforms_settings', array() );
		return ! isset( $settings['enable_honeypot'] ) || ! empty( $settings['enable_honeypot'] );
	}

	/**
	 * Check if honeypot is enabled for a specific form.
	 *
	 * @param array $form_config Form configuration array.
	 * @return bool True if enabled for this form.
	 */
	public static function is_enabled_for_form( array $form_config ): bool {
		// Check form-level override first
		if ( isset( $form_config['disable_honeypot'] ) && $form_config['disable_honeypot'] ) {
			return false;
		}

		// Fall back to global setting
		return self::is_enabled();
	}
}
