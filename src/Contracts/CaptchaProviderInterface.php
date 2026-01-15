<?php

namespace SubtleForms\Contracts;

/**
 * CAPTCHA Provider Interface
 *
 * Defines the contract for all CAPTCHA providers.
 */
interface CaptchaProviderInterface {

	/**
	 * Get provider name
	 *
	 * @return string Provider identifier (e.g., 'recaptcha', 'hcaptcha')
	 */
	public function getName();

	/**
	 * Check if provider is properly configured
	 *
	 * @return bool
	 */
	public function isConfigured();

	/**
	 * Render CAPTCHA widget HTML
	 *
	 * @param array $config Provider configuration (site_key, version, etc.)
	 * @return string HTML markup for CAPTCHA widget
	 */
	public function render( $config );

	/**
	 * Verify CAPTCHA response
	 *
	 * @param string $response CAPTCHA response token from client
	 * @param string $secret_key Secret key for verification
	 * @param string $remote_ip Client IP address
	 * @return array ['success' => bool, 'error' => string|null]
	 */
	public function verify( $response, $secret_key, $remote_ip );

	/**
	 * Get JavaScript URL for provider
	 *
	 * @param array $config Provider configuration
	 * @return string JavaScript URL
	 */
	public function getScriptUrl( $config );
}
