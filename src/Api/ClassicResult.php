<?php
/**
 * The outcome of a form posted without AJAX (a block with AJAX turned off).
 *
 * The post is answered with a redirect back to the page, so the outcome is
 * kept for a few minutes under a random token passed in the query string.
 * The block reads it when the page renders and hands it to the renderer,
 * which shows the confirmation, or the errors with the visitor's answers.
 *
 * @package SubtleForms
 * @since   2.4.0
 */

namespace SubtleForms\Api;

defined( 'ABSPATH' ) || exit;

/**
 * Classic submit outcome.
 */
final class ClassicResult {

	/**
	 * Query argument that carries the token.
	 */
	const QUERY = 'subtleforms_result';

	/**
	 * How long an outcome is kept, in seconds.
	 */
	const TTL = 600;

	/**
	 * Answers that are never kept or sent back: spam traps and CAPTCHA
	 * tokens. Add-ons add their request values through RequestKeys.
	 */
	const SKIP_VALUES = \SubtleForms\Support\RequestKeys::BUILT_IN;

	/**
	 * Outcomes already read in this request, by token.
	 *
	 * @var array<string, array>
	 */
	private static array $read = array();

	/**
	 * What a submit response means for a classic post.
	 *
	 * @param int   $status HTTP status of the submit response.
	 * @param mixed $body   Response body.
	 * @param int   $formId Form ID.
	 * @param array $values Answers as posted.
	 * @return array{form_id: int, ok: bool, body: array, values: array, redirect: string, configured: bool}
	 */
	public static function outcome( int $status, $body, int $formId, array $values ): array {
		$body = is_array( $body ) ? $body : array();
		$data = is_array( $body['data'] ?? null ) ? $body['data'] : array();
		$ok   = $status < 400 && ! empty( $data['success'] );

		$redirect   = '';
		$configured = false;
		if ( $ok ) {
			$confirmation = is_array( $data['confirmation'] ?? null ) ? $data['confirmation'] : array();
			if ( ! empty( $data['redirect'] ) && is_string( $data['redirect'] ) ) {
				// An add-on takes the visitor to another page.
				$redirect = $data['redirect'];
			} elseif ( 'redirect' === ( $confirmation['type'] ?? '' ) && ! empty( $confirmation['redirectUrl'] ) ) {
				// The form's own confirmation, set by an administrator.
				$redirect   = (string) $confirmation['redirectUrl'];
				$configured = true;
			}
		}

		// Classic posts hand answers back through a short-lived transient for
		// error redisplay. Never store raw POST. Plain answers are stripped like
		// the AJAX submit path; only schema rich_text keys keep allowlisted markup
		// so wp_kses does not entity-encode ordinary text (e.g. Tom & Jerry).
		$kept = array_diff_key( $values, array_flip( \SubtleForms\Support\RequestKeys::all() ) );
		$rich_keys = array();
		$schema    = \SubtleForms\Engine\FormRestrictions::activeSchema( $formId );
		if ( is_array( $schema ) ) {
			$rich_keys = \SubtleForms\Validation\Sanitizer::fieldKeysOfType( $schema['fields'] ?? array(), 'rich_text' );
		}
		$kept = \SubtleForms\Validation\Sanitizer::sanitizeClassicRedisplay( $kept, $rich_keys );

		return array(
			'form_id'    => $formId,
			'ok'         => $ok,
			'body'       => $body,
			'values'     => $kept,
			'redirect'   => $redirect,
			'configured' => $configured,
		);
	}

	/**
	 * Keep an outcome and return its token.
	 *
	 * @param array $outcome From outcome().
	 * @return string
	 */
	public static function store( array $outcome ): string {
		$token = strtolower( wp_generate_password( 24, false ) );
		unset( $outcome['redirect'], $outcome['configured'] );
		set_transient( self::key( $token ), $outcome, self::TTL );
		return $token;
	}

	/**
	 * The outcome for a form on this page view, if the visitor just posted it.
	 * The stored copy is removed once read.
	 *
	 * @param int $formId Form ID.
	 * @return array|null { ok, body, values }
	 */
	public static function forForm( int $formId ): ?array {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- A random token that only reads a short-lived outcome; nothing is changed.
		$token = isset( $_GET[ self::QUERY ] ) ? sanitize_key( wp_unslash( $_GET[ self::QUERY ] ) ) : '';
		if ( '' === $token ) {
			return null;
		}
		if ( ! isset( self::$read[ $token ] ) ) {
			$stored = get_transient( self::key( $token ) );
			if ( ! is_array( $stored ) ) {
				return null;
			}
			delete_transient( self::key( $token ) );
			self::$read[ $token ] = $stored;
		}
		$outcome = self::$read[ $token ];
		if ( (int) ( $outcome['form_id'] ?? 0 ) !== $formId ) {
			return null;
		}
		return array(
			'ok'     => ! empty( $outcome['ok'] ),
			'body'   => is_array( $outcome['body'] ?? null ) ? $outcome['body'] : array(),
			'values' => is_array( $outcome['values'] ?? null ) ? $outcome['values'] : array(),
		);
	}

	/**
	 * Fill the merge tags of a redirect confirmation the way the browser does
	 * for an AJAX submit (fillConfirmation): {field:key}, {key}, {form_title}
	 * and {entry_id}, single or double braces, values URL-encoded. A tag
	 * without a value is removed.
	 *
	 * @param string     $url       Redirect address with tags.
	 * @param array      $values    Answers as posted.
	 * @param string     $formTitle Form title.
	 * @param int|string $entryId   Entry ID.
	 * @return string
	 */
	public static function fillTags( string $url, array $values, string $formTitle, $entryId ): string {
		return (string) preg_replace_callback(
			'/\{\{?\s*(?:field:)?([\w.-]+)\s*\}?\}/',
			static function ( $m ) use ( $values, $formTitle, $entryId ) {
				$key = $m[1];
				if ( 'form_title' === $key ) {
					$raw = $formTitle;
				} elseif ( 'entry_id' === $key ) {
					$raw = (string) $entryId;
				} elseif ( array_key_exists( $key, $values ) ) {
					$raw = $values[ $key ];
				} else {
					return '';
				}
				if ( is_array( $raw ) ) {
					$scalars = array_filter( $raw, 'is_scalar' );
					$raw     = array_is_list( $raw ) ? implode( ', ', array_map( 'strval', $scalars ) ) : implode( ' ', array_filter( array_map( 'strval', $scalars ), 'strlen' ) );
				}
				return null === $raw ? '' : rawurlencode( (string) $raw );
			},
			$url
		);
	}

	/**
	 * Let wp_safe_redirect() follow a redirect confirmation an administrator
	 * set to another site, like the AJAX flow does. Only that host is added,
	 * and only http and https addresses count.
	 *
	 * @param string $url Configured redirect address.
	 * @return string The host that was allowed, or '' when none was.
	 */
	public static function allowHostOf( string $url ): string {
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		$host   = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		if ( '' === $host || ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
			return '';
		}
		add_filter(
			'allowed_redirect_hosts',
			static function ( $hosts ) use ( $host ) {
				$hosts   = is_array( $hosts ) ? $hosts : array();
				$hosts[] = $host;
				return array_values( array_unique( $hosts ) );
			}
		);
		return $host;
	}

	/**
	 * The page to return to with the token, without an older token.
	 *
	 * @param string $page  Page address.
	 * @param string $token Token.
	 * @return string
	 */
	public static function returnUrl( string $page, string $token ): string {
		return add_query_arg( self::QUERY, $token, remove_query_arg( self::QUERY, $page ) );
	}

	/**
	 * Transient name for a token.
	 *
	 * @param string $token Token.
	 * @return string
	 */
	private static function key( string $token ): string {
		return 'subtleforms_classic_' . $token;
	}
}
