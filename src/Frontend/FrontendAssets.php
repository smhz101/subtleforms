<?php
declare(strict_types=1);

namespace SubtleForms\Frontend;

use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The frontend bundle, enqueued from wherever a form is rendered.
 *
 * Both the shortcode and the block output a placeholder div that the frontend
 * script hydrates, so both need exactly the same script, style and localised
 * settings. Keeping that in one place is not only tidier: when the block
 * enqueued its own reduced version, forms embedded as blocks silently lost the
 * configured success and error messages, the redirect, and the CAPTCHA script.
 *
 * Enqueuing happens at render time rather than on an `is_singular()` guess, so
 * a form placed in a template part, a widget area or a block-theme template
 * gets its assets like any other placement. Forms found before the page is
 * drawn (FormDetector) are enqueued earlier, so the stylesheet goes in the
 * head; a form drawn after the footer scripts were printed (a popup printed
 * late in the footer) still gets its assets (2.6.0).
 *
 * The script is deferred (2.6.0). WordPress loads it normally instead when an
 * add-on script that depends on it is not deferred.
 */
final class FrontendAssets {

	/** Script and style handle. */
	public const HANDLE = 'subtleforms-frontend';

	/**
	 * Field types whose code is downloaded only when a form has them, by
	 * group. Mirrors resources/frontend/components/fields/lazyFields.jsx.
	 */
	private const TYPE_GROUPS = array(
		'date'             => 'date',
		'time'             => 'date',
		'datetime'         => 'date',
		'country'          => 'geo',
		'address_group'    => 'geo',
		'file_upload'      => 'upload',
		'image_upload'     => 'upload',
		'payment_amount'   => 'payments',
		'payment_summary'  => 'payments',
		'payment_coupon'   => 'payments',
		'payment_product'  => 'payments',
		'payment_choice'   => 'payments',
		'payment_card'     => 'payments',
		'repeat_container' => 'repeater',
		'chained_select'   => 'chained',
		'rich_text'        => 'richText',
	);

	/**
	 * Enqueue the frontend bundle once per request.
	 *
	 * @param Settings|null       $settings       Plugin settings, when available.
	 * @param CaptchaManager|null $captchaManager CAPTCHA manager, when available.
	 */
	public static function enqueue( ?Settings $settings = null, ?CaptchaManager $captchaManager = null, array $providers = array() ): void {
		$enqueued = wp_script_is( self::HANDLE, 'enqueued' ) || wp_script_is( self::HANDLE, 'done' );

		$asset_file = SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/frontend.asset.php';
		$asset      = file_exists( $asset_file ) ? require $asset_file : array(
			'dependencies' => array(),
			'version'      => SUBTLEFORMS_VERSION,
		);

		$dependencies = $asset['dependencies'];

		// Load each CAPTCHA provider the form needs, including a field that
		// uses its own keys when Settings has CAPTCHA off.
		$needed = array();
		if ( $captchaManager && $captchaManager->isEnabled() && $captchaManager->isConfigured() ) {
			$active = $captchaManager->getActiveProviderName();
			if ( '' !== $active ) {
				$needed[] = $active;
			}
		}
		foreach ( $providers as $provider ) {
			if ( is_string( $provider ) && '' !== $provider ) {
				$needed[] = $provider;
			}
		}
		$needed = array_values( array_unique( $needed ) );
		foreach ( $needed as $provider ) {
			$handle = 'subtleforms-captcha-' . $provider;
			if ( wp_script_is( $handle, 'enqueued' ) || wp_script_is( $handle, 'done' ) || ! $captchaManager ) {
				if ( wp_script_is( $handle, 'registered' ) ) {
					$dependencies[] = $handle;
				}
				continue;
			}
			$script_url = $captchaManager->scriptUrlFor( $provider );
			if ( '' === $script_url ) {
				continue;
			}
			wp_enqueue_script(
				$handle,
				$script_url,
				array(),
				SUBTLEFORMS_VERSION,
				true
			);
			$dependencies[] = $handle;
		}

		if ( $enqueued ) {
			self::printLateIfNeeded();
			return;
		}

		wp_enqueue_script(
			self::HANDLE,
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
			$dependencies,
			$asset['version'],
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);

		wp_set_script_translations( 'subtleforms-frontend', 'subtleforms', SUBTLEFORMS_PLUGIN_DIR . 'languages' );

		wp_localize_script(
			self::HANDLE,
			'subtleformsFrontend',
			array(
				'restUrl'        => rest_url( 'subtleforms/v1' ),
				// Where the field code files are, for a page whose optimiser
				// moved or combined the main script (2.6.0).
				'assetsUrl'      => SUBTLEFORMS_PLUGIN_URL . 'build/frontend/',
				// Only logged-in users need a nonce; a guest's would go stale in a
				// cached page and block the submit (FF-03).
				'nonce'          => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
				'successMessage' => $settings ? $settings->get( 'success_message' ) : __( 'Thank you! Your submission has been received.', 'subtleforms' ),
				'errorMessage'   => $settings ? $settings->get( 'error_message' ) : __( 'An error occurred. Please try again.', 'subtleforms' ),
				'redirectUrl'    => $settings ? $settings->get( 'redirect_after_submit' ) : '',
				'currency'       => $settings ? strtoupper( (string) ( $settings->get( 'ext_payments_currency' ) ?: 'USD' ) ) : 'USD',
				'locale'         => str_replace( '_', '-', get_locale() ),
				/**
				 * Language of the page the form is on, sent with every request
				 * the live form makes (2.4.1). Translation add-ons return the
				 * current Polylang or WPML language so the form's labels and
				 * confirmation come back translated. Empty means no language.
				 *
				 * @param string $language Language code.
				 * @since 2.4.1
				 */
				'lang'           => sanitize_key( (string) apply_filters( 'subtleforms/frontend/language', '' ) ),
				'weekStartsOn'   => (int) get_option( 'start_of_week', 0 ),
				// Default-value tokens {user_email} and {user_name} (2.0).
				'user'           => is_user_logged_in()
					? array(
						'email' => wp_get_current_user()->user_email,
						'name'  => wp_get_current_user()->display_name,
					)
					: null,
			)
		);

		wp_enqueue_style(
			self::HANDLE,
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/index.jsx.css',
			array(),
			$asset['version']
		);

		/**
		 * Fires after the public form assets are enqueued, so add-ons (such as
		 * a payment gateway) can load their own scripts alongside.
		 *
		 * @param Settings|null $settings Plugin settings.
		 * @since 2.1.0
		 */
		do_action( 'subtleforms/frontend/enqueued', $settings );

		self::printLateIfNeeded();
	}

	/**
	 * Groups of field code a schema needs (data-features on the container),
	 * so the browser can start downloading them while the form loads.
	 *
	 * @param array<string, mixed>|null $schema Active schema.
	 * @return string[] Group names, sorted.
	 */
	public static function fieldGroups( ?array $schema ): array {
		if ( ! is_array( $schema ) ) {
			return array();
		}
		$groups = array();
		if ( 'conversational' === strtolower( (string) ( $schema['metadata']['type'] ?? '' ) ) ) {
			$groups['conversational'] = true;
		}
		$walk = static function ( $node ) use ( &$walk, &$groups ): void {
			if ( ! is_array( $node ) ) {
				return;
			}
			if ( array_is_list( $node ) ) {
				foreach ( $node as $child ) {
					$walk( $child );
				}
				return;
			}
			$type   = (string) ( $node['type'] ?? '' );
			$config = is_array( $node['config'] ?? null ) ? $node['config'] : array();
			if ( ( 'phone' === $type || 'tel' === $type ) && ( ! empty( $node['enableCountryCode'] ) || ! empty( $config['enableCountryCode'] ) ) ) {
				$groups['geo'] = true;
			} elseif ( isset( self::TYPE_GROUPS[ $type ] ) ) {
				$groups[ self::TYPE_GROUPS[ $type ] ] = true;
			}
			foreach ( array( 'fields', 'children', 'columns' ) as $key ) {
				$walk( $node[ $key ] ?? null );
				$walk( $config[ $key ] ?? null );
			}
		};
		$walk( $schema['fields'] ?? null );
		$names = array_keys( $groups );
		sort( $names );
		return $names;
	}

	/** Form IDs whose data is preloaded from the page head. */
	private static $preloads = array();

	/** Whether the late print is scheduled. */
	private static $lateScheduled = false;

	/** Field code files whose translations were added. */
	private static $translatedChunks = array();

	/** Field code groups whose files are preloaded from the page head. */
	private static $preloadGroups = array();

	/** Webpack chunk name of each field code group. */
	private const GROUP_CHUNKS = array(
		'chained'        => 'field-chained-select',
		'conversational' => 'form-conversational',
		'date'           => 'field-date',
		'geo'            => 'field-phone-country',
		'payments'       => 'field-payments',
		'repeater'       => 'field-repeater',
		'richText'       => 'field-rich-text',
		'upload'         => 'field-upload',
	);

	/**
	 * Let the browser fetch a form's data from the page head, while the page
	 * is still loading, so the request has usually finished by the time the
	 * script asks for it (2.6.0).
	 *
	 * Only for visitors who are not logged in (their request carries no
	 * nonce, so it is the same request the script makes), and only while the
	 * head is not printed yet: a block theme draws its forms before the head,
	 * and forms found early (FormDetector) are known by then. A form drawn
	 * later loads exactly as before. Nothing is added to the form's markup.
	 *
	 * @param int $formId Form ID.
	 * @return bool Whether the hint will be printed.
	 */
	public static function preloadSchema( int $formId ): bool {
		if ( $formId <= 0 || is_admin() || is_user_logged_in() || is_feed() ) {
			return false;
		}
		if ( ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || wp_doing_ajax() ) {
			return false;
		}
		// wp_preload_resources() runs early in wp_head, right after
		// wp_enqueue_scripts. Once it ran, a hint would be too late.
		if ( did_action( 'wp_head' ) && ! doing_action( 'wp_enqueue_scripts' ) ) {
			return false;
		}
		/**
		 * Whether to preload a form's data from the page head.
		 *
		 * @param bool $enabled Default true.
		 * @param int  $formId  Form ID.
		 * @since 2.6.0
		 */
		if ( ! apply_filters( 'subtleforms/frontend/preload_schema', true, $formId ) ) {
			return false;
		}
		if ( ! self::$preloads && ! self::$preloadGroups ) {
			add_filter( 'wp_preload_resources', array( self::class, 'preloadResources' ) );
		}
		self::$preloads[ $formId ] = true;
		return true;
	}

	/**
	 * Let the browser fetch the code of a form's heavier fields from the page
	 * head, in parallel with the main script, instead of after it ran
	 * (2.6.0). Same timing rule as preloadSchema(); for every visitor.
	 *
	 * @param array<string, mixed>|null $schema Active schema.
	 * @return int Number of files hinted.
	 */
	public static function preloadFieldCode( ?array $schema ): int {
		$groups = array_intersect( self::fieldGroups( $schema ), array_keys( self::GROUP_CHUNKS ) );
		if ( ! $groups || is_admin() || is_feed() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || wp_doing_ajax() ) {
			return 0;
		}
		if ( did_action( 'wp_head' ) && ! doing_action( 'wp_enqueue_scripts' ) ) {
			return 0;
		}
		if ( ! self::$preloads && ! self::$preloadGroups ) {
			add_filter( 'wp_preload_resources', array( self::class, 'preloadResources' ) );
		}
		foreach ( $groups as $group ) {
			self::$preloadGroups[ $group ] = true;
		}
		return count( $groups );
	}

	/**
	 * Translations of the strings in a form's field code files (2.6.0).
	 *
	 * WordPress loads a script's translations by the script's file name, and
	 * the field code lives in separate files, so their translations are added
	 * to the form script here, once per file, when a form that needs them is
	 * drawn. Nothing is added on an English site or when no translation file
	 * exists.
	 *
	 * @param array<string, mixed>|null $schema Active schema.
	 */
	public static function loadFieldTranslations( ?array $schema ): void {
		if ( ! wp_script_is( self::HANDLE, 'registered' ) ) {
			return;
		}
		$files = self::chunkFiles();
		$base  = self::chunkBaseUrl();
		foreach ( self::fieldGroups( $schema ) as $group ) {
			$chunk = self::GROUP_CHUNKS[ $group ] ?? '';
			$file  = $files[ $chunk ] ?? '';
			if ( '' === $chunk || ! is_string( $file ) || '' === $file || isset( self::$translatedChunks[ $chunk ] ) ) {
				continue;
			}
			self::$translatedChunks[ $chunk ] = true;
			// A handle that is registered, never enqueued: it only tells
			// WordPress which file the translations belong to.
			$handle = self::HANDLE . '-' . $chunk;
			wp_register_script( $handle, $base . $file, array(), null, true ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- The file name carries its hash.
			$json = load_script_textdomain( $handle, 'subtleforms', SUBTLEFORMS_PLUGIN_DIR . 'languages' );
			if ( ! is_string( $json ) || '' === $json ) {
				continue;
			}
			wp_add_inline_script(
				self::HANDLE,
				sprintf(
					'( function( domain, translations ) { var localeData = translations.locale_data[ domain ] || translations.locale_data.messages; localeData[""].domain = domain; wp.i18n.setLocaleData( localeData, domain ); } )( "subtleforms", %s );',
					$json
				),
				'before'
			);
		}
	}

	/**
	 * Adds the form data and field code hints to wp_preload_resources().
	 *
	 * @param mixed $resources Resources.
	 * @return mixed
	 */
	public static function preloadResources( $resources ) {
		if ( ! is_array( $resources ) ) {
			return $resources;
		}
		foreach ( array_keys( self::$preloads ) as $formId ) {
			$resources[] = array(
				'href'        => self::schemaUrl( (int) $formId ),
				'as'          => 'fetch',
				'crossorigin' => 'anonymous',
			);
		}
		$files = self::chunkFiles();
		$base  = self::chunkBaseUrl();
		foreach ( array_keys( self::$preloadGroups ) as $group ) {
			$file = $files[ self::GROUP_CHUNKS[ $group ] ?? '' ] ?? '';
			if ( is_string( $file ) && '' !== $file && '' !== $base ) {
				// Low priority: the stylesheet and the page's own scripts come
				// first; these only have to arrive before the main script ran.
				$resources[] = array(
					'href'          => $base . $file,
					'as'            => 'script',
					'fetchpriority' => 'low',
				);
			}
		}
		return $resources;
	}

	/**
	 * Lazy chunk files by chunk name, from build/frontend/chunks.json.
	 *
	 * @return array<string, string>
	 */
	private static function chunkFiles(): array {
		$file = SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/chunks.json';
		if ( ! is_readable( $file ) ) {
			return array();
		}
		$data = json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local build file.
		return is_array( $data ) ? $data : array();
	}

	/**
	 * Folder the main script is served from, as the browser sees it: the
	 * script loads its chunks from there (webpack's automatic public path), so
	 * a CDN that rewrites script URLs is followed here too.
	 *
	 * @return string URL ending in a slash, or ''.
	 */
	private static function chunkBaseUrl(): string {
		$src = (string) apply_filters( 'script_loader_src', SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js', self::HANDLE );
		$src = (string) preg_replace( '/[?#].*$/', '', $src );
		$pos = strrpos( $src, '/' );
		return false === $pos ? '' : substr( $src, 0, $pos + 1 );
	}

	/** Test helper: forget the hints and the late print. */
	public static function resetForTests(): void {
		self::$preloads      = array();
		self::$preloadGroups    = array();
		self::$translatedChunks = array();
		self::$lateScheduled    = false;
		remove_filter( 'wp_preload_resources', array( self::class, 'preloadResources' ) );
		remove_action( 'wp_footer', array( self::class, 'printLate' ), PHP_INT_MAX );
		remove_action( 'shutdown', array( self::class, 'printLate' ), 0 );
	}

	/**
	 * The URL the script loads a form from: restRouteUrl() in
	 * resources/frontend/utils/restFetch.js, character for character, or the
	 * preloaded response would not be used.
	 *
	 * @param int $formId Form ID.
	 * @return string
	 */
	public static function schemaUrl( int $formId ): string {
		$url  = rtrim( rest_url( 'subtleforms/v1' ), '/' ) . '/forms/' . $formId . '/schema';
		$lang = sanitize_key( (string) apply_filters( 'subtleforms/frontend/language', '' ) );
		if ( '' !== $lang ) {
			$url .= ( false === strpos( $url, '?' ) ? '?' : '&' ) . 'lang=' . rawurlencode( $lang );
		}
		return $url;
	}

	/**
	 * A form drawn after the footer scripts were printed (for example in a
	 * popup a plugin prints at the end of the footer) would never get its
	 * script. Print what is still queued at the end of the footer, or at the
	 * end of the page, instead. Only on normal page views.
	 */
	private static function printLateIfNeeded(): void {
		if ( self::$lateScheduled || ! did_action( 'wp_print_footer_scripts' ) ) {
			return;
		}
		if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || is_feed() || wp_is_json_request() ) {
			return;
		}
		self::$lateScheduled = true;
		$print               = array( self::class, 'printLate' );
		if ( doing_action( 'wp_footer' ) ) {
			add_action( 'wp_footer', $print, PHP_INT_MAX );
		} else {
			add_action( 'shutdown', $print, 0 );
		}
	}

	/**
	 * Print the stylesheets and scripts still queued (used after the footer).
	 */
	public static function printLate(): void {
		wp_print_styles();
		wp_print_scripts();
	}
}
