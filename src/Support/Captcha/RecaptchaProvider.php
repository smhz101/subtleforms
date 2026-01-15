<?php

namespace SubtleForms\Support\Captcha;

use SubtleForms\Contracts\CaptchaProviderInterface;

/**
 * Google reCAPTCHA Provider
 *
 * Supports both reCAPTCHA v2 and v3.
 */
class RecaptchaProvider implements CaptchaProviderInterface {

	/**
	 * Get provider name
	 *
	 * @return string
	 */
	public function getName() {
		return 'recaptcha';
	}

	/**
	 * Check if provider is properly configured
	 *
	 * @return bool
	 */
	public function isConfigured() {
		$settings = get_option( 'subtleforms_settings', array() );
		return ! empty( $settings['captcha_recaptcha_site_key'] ) && ! empty( $settings['captcha_recaptcha_secret_key'] );
	}

	/**
	 * Render CAPTCHA widget HTML
	 *
	 * @param array $config Provider configuration
	 * @return string
	 */
	public function render( $config ) {
		$site_key = $config['site_key'] ?? '';
		$version  = $config['version'] ?? 'v2';

		if ( empty( $site_key ) ) {
			return '';
		}

		if ( $version === 'v3' ) {
			// v3: invisible, renders via JS
			return sprintf(
				'<input type="hidden" name="g-recaptcha-response" id="g-recaptcha-response" class="subtleforms-recaptcha-v3" data-sitekey="%s">',
				esc_attr( $site_key )
			);
		}

		// v2: visible checkbox
		return sprintf(
			'<div class="g-recaptcha" data-sitekey="%s"></div>',
			esc_attr( $site_key )
		);
	}

	/**
	 * Verify CAPTCHA response
	 *
	 * @param string $response CAPTCHA response token
	 * @param string $secret_key Secret key
	 * @param string $remote_ip Client IP
	 * @return array
	 */
	public function verify( $response, $secret_key, $remote_ip ) {
		if ( empty( $response ) ) {
			return array(
				'success' => false,
				'error'   => __( 'CAPTCHA response is missing.', 'subtleforms' ),
			);
		}

		$verify_url = 'https://www.google.com/recaptcha/api/siteverify';

		$body = array(
			'secret'   => $secret_key,
			'response' => $response,
			'remoteip' => $remote_ip,
		);

		$request = wp_remote_post(
			$verify_url,
			array(
				'body'    => $body,
				'timeout' => 10,
			)
		);

		if ( is_wp_error( $request ) ) {
			return array(
				'success' => false,
				'error'   => __( 'CAPTCHA verification request failed.', 'subtleforms' ),
			);
		}

		$response_body = wp_remote_retrieve_body( $request );
		$result        = json_decode( $response_body, true );

		if ( ! empty( $result['success'] ) ) {
			return array( 'success' => true );
		}

		$error_codes = $result['error-codes'] ?? array();
		return array(
			'success' => false,
			'error'   => __( 'CAPTCHA verification failed.', 'subtleforms' ) . ' (' . implode( ', ', $error_codes ) . ')',
		);
	}

	/**
	 * Get JavaScript URL
	 *
	 * @param array $config
	 * @return string
	 */
	public function getScriptUrl( $config ) {
		$version = $config['version'] ?? 'v2';

		if ( $version === 'v3' ) {
			return 'https://www.google.com/recaptcha/api.js?render=' . ( $config['site_key'] ?? '' );
		}

		return 'https://www.google.com/recaptcha/api.js';
	}
}
