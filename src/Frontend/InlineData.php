<?php
/**
 * A form's public data, printed into the page next to the form (2.6.1).
 *
 * The front-end script used to ask the REST API for the form once it ran. That
 * is a full round trip after the script, and on a slow host, or behind a
 * caching plugin that bypasses the REST API, it was the slowest part of the
 * page. The shortcode and the block now print the same data the schema route
 * returns, in a JSON script tag, and the script draws the form from it. The
 * route stays as the fallback for forms mounted from script and for pages
 * where nothing was printed.
 *
 * What is printed is exactly FormsApi::publicPayload(): the public schema and
 * a signed load time. No notification address, webhook, API key, internal
 * setting or nonce. A nonce is not printed on purpose: a cached page would
 * carry it for days after it expired (visitors have none, and the script asks
 * for a fresh one only for logged-in people, from the localised settings).
 *
 * @package SubtleForms
 * @since   2.6.1
 */

namespace SubtleForms\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Builds and prints the inline form data.
 */
final class InlineData {

	/** Forms whose tag was printed during this request. */
	private static $printed = array();

	/** Payloads built during this request, by form ID. */
	private static $payloads = array();

	/**
	 * Id of the script tag for a form. The script reads the same id.
	 *
	 * @param int $formId Form ID.
	 * @return string
	 */
	public static function tagId( int $formId ): string {
		return 'sf-form-data-' . $formId;
	}

	/**
	 * Whether this request may carry the data: a normal page view for a
	 * visitor. People who can edit posts get the route's own answer (it is
	 * not the public one), and feeds, REST, AJAX and admin screens never draw
	 * a form from the page.
	 *
	 * @return bool
	 */
	public static function enabled(): bool {
		if ( is_admin() || is_feed() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || wp_is_json_request() ) {
			return false;
		}
		if ( is_user_logged_in() && current_user_can( 'edit_posts' ) ) {
			return false;
		}
		/**
		 * Whether to print a form's data into the page so the form can be drawn
		 * without a request to the REST API. Turn it off when a cache keeps
		 * pages long after a form changes and the form must always be read live.
		 *
		 * @param bool $enabled Default true.
		 * @since 2.6.1
		 */
		return (bool) apply_filters( 'subtleforms/frontend/inline_form_data', true );
	}

	/**
	 * The data for a published form, as the schema route returns it.
	 *
	 * @param int $formId Form ID.
	 * @return array<string, mixed>|null Null when the form is missing, not published or has no schema.
	 */
	public static function payload( int $formId ): ?array {
		if ( array_key_exists( $formId, self::$payloads ) ) {
			return self::$payloads[ $formId ];
		}
		self::$payloads[ $formId ] = self::build( $formId );
		return self::$payloads[ $formId ];
	}

	/**
	 * Whether the tag for a form was printed during this request.
	 *
	 * @param int $formId Form ID.
	 * @return bool
	 */
	public static function printed( int $formId ): bool {
		return isset( self::$printed[ $formId ] );
	}

	/**
	 * @param int $formId Form ID.
	 * @return array<string, mixed>|null
	 */
	private static function build( int $formId ): ?array {
		try {
			$container = \SubtleForms\Plugin::instance()->container();
			$repo      = $container->get( \SubtleForms\Repositories\FormsRepository::class );
			$form      = $repo->find( $formId );
			if ( ! is_array( $form ) || 'published' !== ( $form['status'] ?? '' ) ) {
				return null;
			}
			$api = new \SubtleForms\Api\FormsApi(
				$repo,
				$container->get( \SubtleForms\Repositories\SubmissionsRepository::class ),
				$container->get( \SubtleForms\Support\FeatureGate::class ),
				$container->has( \SubtleForms\Support\Settings::class ) ? $container->get( \SubtleForms\Support\Settings::class ) : null,
				$container->has( \SubtleForms\Support\Captcha\CaptchaManager::class ) ? $container->get( \SubtleForms\Support\Captcha\CaptchaManager::class ) : null
			);
			return $api->publicPayload( $form );
		} catch ( \Throwable $e ) {
			return null;
		}
	}

	/**
	 * The script tag to print next to a form's container.
	 *
	 * Printed once per form per page: a second container for the same form
	 * reads the first one's tag.
	 *
	 * @param int                       $formId Form ID.
	 * @param array<string, mixed>|null $payload Payload from payload(), when the caller has it.
	 * @return string The tag, or '' when the data is not printed here.
	 */
	public static function tag( int $formId, ?array $payload = null ): string {
		if ( $formId <= 0 || ! self::enabled() || isset( self::$printed[ $formId ] ) ) {
			return '';
		}
		$payload = $payload ?? self::payload( $formId );
		if ( null === $payload ) {
			return '';
		}
		// Escaped for a script element: no "<", "&", quote or apostrophe survives,
		// so no value can close the tag or start another one.
		$json = wp_json_encode( $payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		if ( ! is_string( $json ) || '' === $json ) {
			return '';
		}
		self::$printed[ $formId ] = true;
		return sprintf( '<script type="application/json" id="%s">%s</script>', esc_attr( self::tagId( $formId ) ), $json );
	}

	/** Test helper: forget what was printed. */
	public static function resetForTests(): void {
		self::$printed  = array();
		self::$payloads = array();
	}
}
