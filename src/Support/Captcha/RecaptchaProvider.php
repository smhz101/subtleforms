<?php

namespace SubtleForms\Support\Captcha;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Contracts\CaptchaProviderInterface;

use SubtleForms\Support\Logger;
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
		$has_site_key   = ! empty( $settings['captcha_recaptcha_site_key'] );
		$has_secret_key = ! empty( $settings['captcha_recaptcha_secret_key'] );

		if ( ! $has_site_key ) {
			Logger::error( 'reCAPTCHA: Site key is missing or empty' );
		}

		if ( ! $has_secret_key ) {
			Logger::error( 'reCAPTCHA: Secret key is missing or empty' );
		}

		return $has_site_key && $has_secret_key;
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
			// Only v3 answers carry a score. A v3 token passes when it is for
			// our action and the score reaches the threshold; a bare
			// success:true says nothing about whether the visitor is a bot.
			if ( array_key_exists( 'score', $result ) ) {
				$check = self::check_v3( $result );
				if ( true !== $check ) {
					return array(
						'success' => false,
						'error'   => $check,
					);
				}
			}
			return array( 'success' => true );
		}

		$error_codes = $result['error-codes'] ?? array();
		return array(
			'success' => false,
			'error'   => __( 'CAPTCHA verification failed.', 'subtleforms' ) . ' (' . implode( ', ', $error_codes ) . ')',
		);
	}

	/**
	 * Check the score and action of a v3 verification answer.
	 *
	 * @param array $result Decoded siteverify response.
	 * @return true|string True when it passes, otherwise the error text.
	 */
	public static function check_v3( array $result ) {
		/**
		 * Lowest reCAPTCHA v3 score that passes (0.0 to 1.0).
		 *
		 * @param float $min_score Default 0.5.
		 */
		$min_score = (float) apply_filters( 'subtleforms/captcha/recaptcha_min_score', 0.5 );
		/**
		 * The reCAPTCHA v3 action the form page requests.
		 *
		 * @param string $action Default "submit".
		 */
		$action = (string) apply_filters( 'subtleforms/captcha/recaptcha_action', 'submit' );

		if ( '' !== $action && ( $result['action'] ?? '' ) !== $action ) {
			return __( 'CAPTCHA verification failed.', 'subtleforms' ) . ' (action-mismatch)';
		}
		if ( (float) $result['score'] < $min_score ) {
			return __( 'CAPTCHA verification failed.', 'subtleforms' ) . ' (low-score)';
		}
		return true;
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
