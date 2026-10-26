<?php
/**
 * Values the browser sends with a submission that are not answers.
 *
 * The spam trap, the time token and the CAPTCHA responses travel in the same
 * `data` object as the answers. They are read by the checks that need them and
 * are never stored, emailed, shown or sent to a webhook. An add-on that sends
 * its own request values with a submission lists them through the
 * `subtleforms/submission/request_keys` filter, so they are treated the same
 * way and a form cannot use them as field IDs.
 *
 * @package SubtleForms\Support
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class RequestKeys {

	/**
	 * This plugin's own request values.
	 */
	public const BUILT_IN = array( 'website_url', 'form_rendered_at', 'g-recaptcha-response', 'h-captcha-response', 'cf-turnstile-response' );

	/**
	 * Every request value that is not an answer.
	 *
	 * @return string[]
	 */
	public static function all(): array {
		/**
		 * Keys in a submission's `data` that are request values, not answers.
		 * They are read by whoever needs them before the entry is stored, then
		 * dropped, and a field cannot use them as its ID.
		 *
		 * @param string[] $keys Keys.
		 * @since 2.7.2
		 */
		$keys = function_exists( 'apply_filters' ) ? apply_filters( 'subtleforms/submission/request_keys', self::BUILT_IN ) : self::BUILT_IN;
		$keys = array_values( array_unique( array_filter( array_map( 'strval', is_array( $keys ) ? $keys : array() ) ) ) );
		return array_values( array_unique( array_merge( self::BUILT_IN, $keys ) ) );
	}

	/**
	 * Whether a key is a request value.
	 *
	 * @param string $key Key.
	 */
	public static function has( string $key ): bool {
		return in_array( $key, self::all(), true );
	}

	/**
	 * The payload without request values an add-on listed. This plugin's own
	 * spam keys are removed where they are checked.
	 *
	 * @param array $payload Submitted values.
	 * @return array
	 */
	public static function stripAddonKeys( array $payload ): array {
		foreach ( array_diff( self::all(), self::BUILT_IN ) as $key ) {
			unset( $payload[ $key ] );
		}
		return $payload;
	}
}
