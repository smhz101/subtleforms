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
 * gets its assets like any other placement.
 */
final class FrontendAssets {

	/**
	 * Enqueue the frontend bundle once per request.
	 *
	 * @param Settings|null       $settings       Plugin settings, when available.
	 * @param CaptchaManager|null $captchaManager CAPTCHA manager, when available.
	 */
	public static function enqueue( ?Settings $settings = null, ?CaptchaManager $captchaManager = null, array $providers = array() ): void {
		static $enqueued = false;
		static $loaded_providers = array();

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
			if ( isset( $loaded_providers[ $provider ] ) || ! $captchaManager ) {
				if ( isset( $loaded_providers[ $provider ] ) ) {
					$dependencies[] = $loaded_providers[ $provider ];
				}
				continue;
			}
			$script_url = $captchaManager->scriptUrlFor( $provider );
			if ( '' === $script_url ) {
				continue;
			}
			$handle = 'subtleforms-captcha-' . $provider;
			wp_enqueue_script(
				$handle,
				$script_url,
				array(),
				SUBTLEFORMS_VERSION,
				true
			);
			$loaded_providers[ $provider ] = $handle;
			$dependencies[] = $handle;
		}

		if ( $enqueued ) {
			return;
		}
		$enqueued = true;

		wp_enqueue_script(
			'subtleforms-frontend',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
			$dependencies,
			$asset['version'],
			true
		);

		wp_set_script_translations( 'subtleforms-frontend', 'subtleforms', SUBTLEFORMS_PLUGIN_DIR . 'languages' );

		wp_localize_script(
			'subtleforms-frontend',
			'subtleformsFrontend',
			array(
				'restUrl'        => rest_url( 'subtleforms/v1' ),
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
				// Anonymous daily view counter (2.1). See Analytics\Stats.
				'trackViews'     => \SubtleForms\Analytics\Stats::tracksViews( $settings ),
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
			'subtleforms-frontend',
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
	}
}
