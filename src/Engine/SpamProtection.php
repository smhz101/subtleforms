<?php
/**
 * SubtleForms Spam Protection
 *
 * @package   SubtleForms\Engine
 * @version   1.5.0
 */

namespace SubtleForms\Engine;

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
	 *
	 * @var int
	 */
	const MIN_SUBMISSION_TIME = 3;

	/**
	 * Check if submission appears to be spam using Honeypot technique.
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
		if ( self::check_time_trap( $data ) ) {
			$context->setMeta( 'spam_reason', 'submission_too_fast' );
			return true;
		}

		return false;
	}

	/**
	 * Check if honeypot field was filled (indicates bot).
	 *
	 * @param array $data Form submission data.
	 * @return bool True if honeypot was filled.
	 */
	private static function check_honeypot( array $data ): bool {
		if ( ! isset( $data[ self::HONEYPOT_FIELD ] ) ) {
			return false; // Field not present, skip check.
		}

		$value = $data[ self::HONEYPOT_FIELD ];

		// If honeypot has any value, it's spam
		return ! empty( $value );
	}

	/**
	 * Check if form was submitted too quickly (time trap).
	 *
	 * @param array $data Form submission data.
	 * @return bool True if submitted too fast.
	 */
	private static function check_time_trap( array $data ): bool {
		if ( ! isset( $data[ self::TIME_FIELD ] ) ) {
			return false; // Field not present, skip check.
		}

		$rendered_at = (int) $data[ self::TIME_FIELD ];
		$now         = time();

		$time_diff = $now - $rendered_at;

		// If less than minimum time, likely a bot
		return $time_diff < self::MIN_SUBMISSION_TIME;
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
				<input type="hidden" name="%4$s" value="%5$d" />
			</div>',
			absint( $form_id ),
			esc_html__( 'Leave this field empty', 'subtleforms' ),
			esc_attr( $honeypot_name ),
			esc_attr( $time_name ),
			absint( $current_time )
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
		return ! empty( $settings['enable_honeypot'] );
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
