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
	public static function enqueue( ?Settings $settings = null, ?CaptchaManager $captchaManager = null ): void {
		static $enqueued = false;
		if ( $enqueued ) {
			return;
		}
		$enqueued = true;

		$asset_file = SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/frontend.asset.php';
		$asset      = file_exists( $asset_file ) ? require $asset_file : array(
			'dependencies' => array(),
			'version'      => SUBTLEFORMS_VERSION,
		);

		$dependencies = $asset['dependencies'];

		// The CAPTCHA provider's API has to exist before our script runs, so it
		// is enqueued first and declared as a dependency rather than merely
		// added to the page.
		if ( $captchaManager && $captchaManager->isEnabled() && $captchaManager->isConfigured() ) {
			$script_url = $captchaManager->getScriptUrl();
			if ( ! empty( $script_url ) ) {
				wp_enqueue_script(
					'subtleforms-captcha',
					$script_url,
					array(),
					SUBTLEFORMS_VERSION,
					true
				);
				$dependencies[] = 'subtleforms-captcha';
			}
		}

		wp_enqueue_script(
			'subtleforms-frontend',
			SUBTLEFORMS_PLUGIN_URL . 'build/frontend/frontend.js',
			$dependencies,
			$asset['version'],
			true
		);

		wp_localize_script(
			'subtleforms-frontend',
			'subtleformsFrontend',
			array(
				'restUrl'        => rest_url( 'subtleforms/v1' ),
				'nonce'          => wp_create_nonce( 'wp_rest' ),
				'successMessage' => $settings ? $settings->get( 'success_message' ) : __( 'Thank you! Your submission has been received.', 'subtleforms' ),
				'errorMessage'   => $settings ? $settings->get( 'error_message' ) : __( 'An error occurred. Please try again.', 'subtleforms' ),
				'redirectUrl'    => $settings ? $settings->get( 'redirect_after_submit' ) : '',
				'currency'       => $settings ? strtoupper( (string) ( $settings->get( 'ext_payments_currency' ) ?: 'USD' ) ) : 'USD',
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
