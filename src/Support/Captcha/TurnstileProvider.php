<?php

namespace SubtleForms\Support\Captcha;

use SubtleForms\Contracts\CaptchaProviderInterface;

/**
 * Cloudflare Turnstile Provider
 */
class TurnstileProvider implements CaptchaProviderInterface {

	/**
	 * Get provider name
	 *
	 * @return string
	 */
	public function getName() {
		return 'turnstile';
	}

	/**
	 * Check if provider is properly configured
	 *
	 * @return bool
	 */
	public function isConfigured() {
		$settings = get_option( 'subtleforms_settings', array() );
		return ! empty( $settings['captcha_turnstile_site_key'] ) && ! empty( $settings['captcha_turnstile_secret_key'] );
	}

	/**
	 * Render CAPTCHA widget HTML
	 *
	 * @param array $config Provider configuration
	 * @return string
	 */
	public function render( $config ) {
		$site_key = $config['site_key'] ?? '';

		if ( empty( $site_key ) ) {
			return '';
		}

		return sprintf(
			'<div class="cf-turnstile" data-sitekey="%s"></div>',
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

		$verify_url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

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
		return 'https://challenges.cloudflare.com/turnstile/v0/api.js';
	}
}
