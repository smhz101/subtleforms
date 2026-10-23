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
	 * Seconds a time token stays valid (2 hours). An older token must be
	 * refreshed (see refresh_token()) before it is used.
	 *
	 * @var int
	 */
	const TOKEN_TTL = 7200;

	/**
	 * How long a used token that was already stale is remembered (30 days).
	 *
	 * @var int
	 */
	const STALE_CLAIM_TTL = 2592000;

	/**
	 * Key in a form's metadata that holds its own spam settings (2.6.0):
	 * `{ "honeypot": bool, "timeTrap": bool }`.
	 */
	const FORM_KEY = 'spam';

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
	 * The protection a form uses (2.6.0).
	 *
	 * A form's own choice (metadata.spam) wins. A form saved before 2.6.0 has
	 * none and keeps working exactly as it did: the hidden trap field was
	 * always checked, and the time trap followed the site's minimum time.
	 *
	 * @param array|null $schema Form schema (the published one at submit time).
	 * @return array{honeypot: bool, timeTrap: bool, minSeconds: int, own: bool}
	 */
	public static function for_form( ?array $schema ): array {
		$own     = is_array( $schema['metadata'][ self::FORM_KEY ] ?? null ) ? $schema['metadata'][ self::FORM_KEY ] : array();
		$siteMin = self::min_seconds();

		$honeypot = isset( $own['honeypot'] ) && is_bool( $own['honeypot'] ) ? $own['honeypot'] : true;
		$timeTrap = isset( $own['timeTrap'] ) && is_bool( $own['timeTrap'] ) ? $own['timeTrap'] : $siteMin > 0;

		return array(
			'honeypot'   => $honeypot,
			'timeTrap'   => $timeTrap,
			// A form that asks for the time trap while the site minimum is 0
			// uses the usual minimum, so "on" always means on.
			'minSeconds' => $siteMin > 0 ? $siteMin : self::MIN_SUBMISSION_TIME,
			'own'        => isset( $own['honeypot'] ) || isset( $own['timeTrap'] ),
		);
	}

	/**
	 * Spam settings a new form starts with: the site defaults, which are on
	 * for new installs (2.6.0).
	 *
	 * @return array{honeypot: bool, timeTrap: bool}
	 */
	public static function new_form_defaults(): array {
		return array(
			'honeypot' => self::is_enabled(),
			'timeTrap' => self::min_seconds() > 0,
		);
	}

	/**
	 * Give a new form's schema the default spam settings. A choice already in
	 * the schema (a template, an import, a copy) is kept.
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function with_new_form_defaults( array $schema ): array {
		if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$schema['metadata'] = array();
		}
		$own = is_array( $schema['metadata'][ self::FORM_KEY ] ?? null ) ? $schema['metadata'][ self::FORM_KEY ] : array();
		foreach ( self::new_form_defaults() as $key => $value ) {
			if ( ! isset( $own[ $key ] ) || ! is_bool( $own[ $key ] ) ) {
				$own[ $key ] = $value;
			}
		}
		$schema['metadata'][ self::FORM_KEY ] = $own;
		return $schema;
	}

	/**
	 * Why a submission is blocked as spam, or null when it passes (2.6.0).
	 *
	 * @param array $data          Submitted answers (with website_url and form_rendered_at).
	 * @param int   $form_id       Form ID.
	 * @param array $protection    From for_form().
	 * @param bool  $skip_time_trap True for a site admin testing a form.
	 * @param int|null $now        Unix time. Defaults to now.
	 * @return string|null honeypot_filled, time_token_missing, submission_too_fast or null.
	 */
	public static function block_reason( array $data, int $form_id, array $protection, bool $skip_time_trap = false, ?int $now = null ): ?string {
		if ( ! empty( $protection['honeypot'] ) ) {
			$value = $data[ self::HONEYPOT_FIELD ] ?? '';
			if ( is_scalar( $value ) && '' !== (string) $value ) {
				return 'honeypot_filled';
			}
		}

		if ( ! empty( $protection['timeTrap'] ) && ! $skip_time_trap ) {
			$info = self::token_info( $data[ self::TIME_FIELD ] ?? null, $form_id );
			if ( null === $info ) {
				return 'time_token_missing';
			}
			$now = $now ?? time();
			$age = $now - $info['time'];
			// A token older than the lifetime is not accepted as proof of
			// time. The page refreshes it first (a cached page keeps working).
			// A classic post cannot refresh, so it may use it once.
			if ( $age > self::TOKEN_TTL && empty( $protection['acceptStale'] ) ) {
				return 'time_token_expired';
			}
			// A refreshed token was issued to a visitor who had the form open
			// for hours, so the minimum time does not apply to it. A fresh
			// token must be at least the minimum seconds old.
			if ( ! $info['refreshed'] && $age < max( 1, (int) ( $protection['minSeconds'] ?? self::MIN_SUBMISSION_TIME ) ) ) {
				return 'submission_too_fast';
			}
		}

		return null;
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
	 * A token for a visitor whose page token is older than the lifetime. It
	 * is issued only against a validly signed old token (a bot cannot ask for
	 * one from nothing), and it skips the minimum-time check.
	 *
	 * @param mixed    $old     The page's token.
	 * @param int      $form_id Form ID.
	 * @param int|null $now     Unix time. Defaults to now.
	 * @return string|null New token, the same token while it is still valid, or null when the old one is not valid.
	 */
	public static function refresh_token( $old, int $form_id, ?int $now = null ): ?string {
		$info = self::token_info( $old, $form_id );
		if ( null === $info ) {
			return null;
		}
		$now = $now ?? time();
		if ( ( $now - $info['time'] ) <= self::TOKEN_TTL ) {
			return (string) $old;
		}
		return 'v2.' . $now . '.' . $form_id . '.' . self::sign( $now, $form_id, 'r' );
	}

	/**
	 * Use a token once. Returns false when it was used before. The mark is
	 * kept in the object cache (atomic) when there is a persistent one, else
	 * in a transient keyed on the token's hash.
	 *
	 * @param mixed    $token   Token from the submission.
	 * @param int|null $time    Issue time of the token, to size the mark.
	 * @param int|null $now     Unix time. Defaults to now.
	 * @return bool True the first time.
	 */
	public static function claim_token( $token, ?int $time = null, ?int $now = null ): bool {
		if ( ! is_string( $token ) || '' === $token ) {
			return false;
		}
		$now = $now ?? time();
		$ttl = ( null !== $time && ( $now - $time ) <= self::TOKEN_TTL )
			? self::TOKEN_TTL + 60
			: self::STALE_CLAIM_TTL;
		$key = 'subtleforms_tt_' . md5( $token );

		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() ) {
			return (bool) wp_cache_add( $key, 1, 'subtleforms', $ttl );
		}
		if ( false !== get_transient( $key ) ) {
			return false;
		}
		set_transient( $key, 1, $ttl );
		return true;
	}

	/**
	 * Undo claim_token() when the entry was rejected or failed, so the
	 * visitor can send again with the same token.
	 *
	 * @param mixed $token Token that was claimed (null: nothing to release).
	 */
	public static function release_token( $token ): void {
		if ( ! is_string( $token ) || '' === $token ) {
			return;
		}
		$key = 'subtleforms_tt_' . md5( $token );
		if ( function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache() ) {
			wp_cache_delete( $key, 'subtleforms' );
			return;
		}
		delete_transient( $key );
	}

	/**
	 * The issue time of a valid token for this form, or null.
	 *
	 * @param mixed $token   Token from the submission.
	 * @param int   $form_id Form ID.
	 * @return int|null
	 */
	public static function token_time( $token, int $form_id ): ?int {
		$info = self::token_info( $token, $form_id );
		return null === $info ? null : $info['time'];
	}

	/**
	 * Issue time and kind of a valid token for this form, or null.
	 *
	 * @param mixed $token   Token from the submission.
	 * @param int   $form_id Form ID.
	 * @return array{time: int, refreshed: bool}|null
	 */
	public static function token_info( $token, int $form_id ): ?array {
		if ( ! is_string( $token ) || 1 !== preg_match( '/^(v1|v2)\.(\d{9,11})\.(\d+)\.([a-f0-9]{32})$/', $token, $m ) ) {
			return null;
		}
		$time      = (int) $m[2];
		$refreshed = 'v2' === $m[1];
		if ( (int) $m[3] !== $form_id || ! hash_equals( self::sign( $time, $form_id, $refreshed ? 'r' : '' ), $m[4] ) ) {
			return null;
		}
		return array(
			'time'      => $time,
			'refreshed' => $refreshed,
		);
	}

	/**
	 * Signature for a token.
	 */
	private static function sign( int $time, int $form_id, string $kind = '' ): string {
		$data = '' === $kind ? $time . '|' . $form_id : $kind . '|' . $time . '|' . $form_id;
		return substr( hash_hmac( 'sha256', $data, wp_salt( 'nonce' ) ), 0, 32 );
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
				<input type="text" id="subtleforms_hp_%1$d" name="%3$s" value="" autocomplete="off" tabindex="-1" aria-hidden="true" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
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
