<?php

namespace SubtleForms\Support\Captcha;

use SubtleForms\Contracts\CaptchaProviderInterface;
use SubtleForms\Support\Settings;

/**
 * CAPTCHA Manager
 *
 * Responsible for loading providers, validating submissions, and managing CAPTCHA state.
 */
class CaptchaManager {

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * @var array Registered providers
	 */
	private $providers = array();

	/**
	 * Constructor
	 *
	 * @param Settings $settings
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
		$this->registerProviders();
	}

	/**
	 * Register built-in providers
	 */
	private function registerProviders() {
		$this->registerProvider( new RecaptchaProvider() );
		$this->registerProvider( new HCaptchaProvider() );
		$this->registerProvider( new TurnstileProvider() );

		// Allow custom providers via filter
		$this->providers = apply_filters( 'subtleforms_captcha_providers', $this->providers );
	}

	/**
	 * Register a CAPTCHA provider
	 *
	 * @param CaptchaProviderInterface $provider
	 */
	public function registerProvider( CaptchaProviderInterface $provider ) {
		$this->providers[ $provider->getName() ] = $provider;
	}

	/**
	 * Check if CAPTCHA is enabled globally
	 *
	 * @return bool
	 */
	public function isEnabled() {
		$enabled = (bool) $this->settings->get( 'captcha_enabled', false );
		return apply_filters( 'subtleforms_captcha_enabled', $enabled );
	}

	/**
	 * Get active provider name (DEPRECATED - use getConfiguredProviders)
	 *
	 * @deprecated 1.7.2 Use getConfiguredProviders() instead
	 * @return string
	 */
	public function getActiveProviderName() {
		$provider = $this->settings->get( 'captcha_provider', '' );
		return apply_filters( 'subtleforms_captcha_provider', $provider );
	}

	/**
	 * Get active provider instance (DEPRECATED - use getProviderByType)
	 *
	 * @deprecated 1.7.2 Use getProviderByType() instead
	 * @return CaptchaProviderInterface|null
	 */
	public function getActiveProvider() {
		if ( ! $this->isEnabled() ) {
			return null;
		}

		$provider_name = $this->getActiveProviderName();

		if ( empty( $provider_name ) || ! isset( $this->providers[ $provider_name ] ) ) {
			return null;
		}

		return $this->providers[ $provider_name ];
	}

	/**
	 * Get all configured providers
	 *
	 * @return array Array of provider names that are enabled AND configured
	 */
	public function getConfiguredProviders() {
		if ( ! $this->isEnabled() ) {
			return array();
		}

		$configured = array();

		foreach ( $this->providers as $name => $provider ) {
			if ( $this->isProviderEnabled( $name ) && $this->isProviderConfigured( $name ) ) {
				$configured[] = $name;
			}
		}

		return $configured;
	}

	/**
	 * Check if a specific provider is enabled
	 *
	 * @param string $type Provider type (recaptcha, hcaptcha, turnstile)
	 * @return bool
	 */
	public function isProviderEnabled( $type ) {
		$setting_key = 'captcha_' . $type . '_enabled';
		return (bool) $this->settings->get( $setting_key, false );
	}

	/**
	 * Get provider instance by type
	 *
	 * @param string $type Provider type (recaptcha, hcaptcha, turnstile)
	 * @return CaptchaProviderInterface|null
	 */
	public function getProviderByType( $type ) {
		return $this->providers[ $type ] ?? null;
	}

	/**
	 * Check if a specific provider is properly configured
	 *
	 * @param string $type Provider type (recaptcha, hcaptcha, turnstile)
	 * @return bool
	 */
	public function isProviderConfigured( $type ) {
		$provider = $this->getProviderByType( $type );

		if ( ! $provider ) {
			return false;
		}

		return $provider->isConfigured();
	}

	/**
	 * Check if active provider is properly configured (DEPRECATED)
	 *
	 * @deprecated 1.7.2 Use isProviderConfigured($type) instead
	 * @return bool
	 */
	public function isConfigured() {
		$provider = $this->getActiveProvider();

		if ( ! $provider ) {
			$provider_name = $this->getActiveProviderName();
			error_log( "SubtleForms CAPTCHA: Provider '{$provider_name}' not found in registered providers" );
			return false;
		}

		$is_configured = $provider->isConfigured();
		
		if ( ! $is_configured ) {
			error_log( 'SubtleForms CAPTCHA: Provider ' . $provider->getName() . ' is not configured (missing keys)' );
		}

		return $is_configured;
	}

	/**
	 * Render CAPTCHA widget
	 *
	 * @return string HTML markup
	 */
	public function render() {
		if ( ! $this->isEnabled() || ! $this->isConfigured() ) {
			return '';
		}

		$provider = $this->getActiveProvider();
		$config   = $this->getProviderConfig( $provider->getName() );

		error_log( 'SubtleForms CAPTCHA: Rendering with config: ' . wp_json_encode( array(
			'provider'      => $provider->getName(),
			'has_site_key'  => ! empty( $config['site_key'] ),
			'site_key_len'  => strlen( $config['site_key'] ?? '' ),
			'version'       => $config['version'] ?? 'v2',
		) ) );

		$html = $provider->render( $config );

		error_log( 'SubtleForms CAPTCHA: Provider rendered HTML length: ' . strlen( $html ) );

		return $html;
	}

	/**
	 * Verify CAPTCHA response
	 *
	 * @param array $request Request data containing CAPTCHA response
	 * @return array ['success' => bool, 'error' => string|null]
	 */
	public function verify( $request ) {
		if ( ! $this->isEnabled() ) {
			return array( 'success' => true ); // CAPTCHA disabled, pass through
		}

		if ( ! $this->isConfigured() ) {
			return array(
				'success' => false,
				'error'   => __( 'CAPTCHA is not properly configured.', 'subtleforms' ),
			);
		}

		$provider      = $this->getActiveProvider();
		$provider_name = $provider->getName();

		// Get response token from request
		$response = $this->extractResponseToken( $request, $provider_name );

		if ( empty( $response ) ) {
			return array(
				'success' => false,
				'error'   => __( 'CAPTCHA verification failed. Please try again.', 'subtleforms' ),
			);
		}

		// Get secret key
		$config     = $this->getProviderConfig( $provider_name );
		$secret_key = $config['secret_key'] ?? '';

		if ( empty( $secret_key ) ) {
			return array(
				'success' => false,
				'error'   => __( 'CAPTCHA secret key is missing.', 'subtleforms' ),
			);
		}

		// Get client IP
		$remote_ip = $this->getClientIp();

		// Verify with provider
		return $provider->verify( $response, $secret_key, $remote_ip );
	}

	/**
	 * Get provider configuration
	 *
	 * @param string $provider_name
	 * @return array
	 */
	private function getProviderConfig( $provider_name ) {
		$config = array();

		switch ( $provider_name ) {
			case 'recaptcha':
				$config = array(
					'site_key'   => $this->settings->get( 'captcha_recaptcha_site_key', '' ),
					'secret_key' => $this->settings->get( 'captcha_recaptcha_secret_key', '' ),
					'version'    => $this->settings->get( 'captcha_recaptcha_version', 'v2' ),
				);
				break;

			case 'hcaptcha':
				$config = array(
					'site_key'   => $this->settings->get( 'captcha_hcaptcha_site_key', '' ),
					'secret_key' => $this->settings->get( 'captcha_hcaptcha_secret_key', '' ),
				);
				break;

			case 'turnstile':
				$config = array(
					'site_key'   => $this->settings->get( 'captcha_turnstile_site_key', '' ),
					'secret_key' => $this->settings->get( 'captcha_turnstile_secret_key', '' ),
				);
				break;
		}

		return apply_filters( 'subtleforms_captcha_provider_config', $config, $provider_name );
	}

	/**
	 * Extract CAPTCHA response token from request
	 *
	 * @param array $request
	 * @param string $provider_name
	 * @return string
	 */
	private function extractResponseToken( $request, $provider_name ) {
		// Standard field names per provider
		$field_map = array(
			'recaptcha' => 'g-recaptcha-response',
			'hcaptcha'  => 'h-captcha-response',
			'turnstile' => 'cf-turnstile-response',
		);

		$field_name = $field_map[ $provider_name ] ?? '';

		if ( empty( $field_name ) ) {
			return '';
		}

		return $request[ $field_name ] ?? '';
	}

	/**
	 * Get client IP address
	 *
	 * @return string
	 */
	private function getClientIp() {
		$ip = '';

		if ( ! empty( $_SERVER['HTTP_CLIENT_IP'] ) ) {
			$ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_CLIENT_IP'] ) );
		} elseif ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$ip = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
		} elseif ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
			$ip = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
		}

		return $ip;
	}

	/**
	 * Get JavaScript URL for active provider
	 *
	 * @return string
	 */
	public function getScriptUrl() {
		if ( ! $this->isEnabled() || ! $this->isConfigured() ) {
			return '';
		}

		$provider = $this->getActiveProvider();
		$config   = $this->getProviderConfig( $provider->getName() );

		return $provider->getScriptUrl( $config );
	}

	/**
	 * Get all available providers
	 *
	 * @return array
	 */
	public function getProviders() {
		return $this->providers;
	}
}
