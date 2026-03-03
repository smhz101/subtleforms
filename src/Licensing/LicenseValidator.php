<?php

namespace SubtleForms\Licensing;


use SubtleForms\Support\Logger;
/**
 * License Validator
 *
 * Validates license keys with remote licensing server.
 * Implements retry logic, caching, and error handling.
 *
 * @package SubtleForms\Licensing
 * @since 2.0.0
 */
class LicenseValidator {

	/**
	 * License server URL
	 */
	const LICENSE_SERVER_URL = 'https://api.subtleforms.com/v1';

	/**
	 * API timeout in seconds
	 */
	const API_TIMEOUT = 15;

	/**
	 * Cache TTL in seconds (24 hours)
	 */
	const CACHE_TTL = 86400;

	/**
	 * Validate license key
	 *
	 * @param string $key    License key
	 * @param string $domain Current domain
	 * @return array Validation result
	 */
	public function validate( $key, $domain ) {
		// Basic format validation
		if ( ! $this->isValidFormat( $key ) ) {
			return array(
				'status'  => LicenseManager::STATUS_INVALID,
				'message' => __( 'Invalid license key format.', 'subtleforms' ),
			);
		}

		// Check transient cache first
		$cache_key = 'subtleforms_license_check_' . md5( $key . $domain );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return $cached;
		}

		// Call remote API
		$result = $this->callApi( 'validate', array(
			'key'    => $key,
			'domain' => $domain,
		) );

		// Cache the result
		if ( $result['success'] ) {
			set_transient( $cache_key, $result, self::CACHE_TTL );
		}

		return $result;
	}

	/**
	 * Activate license
	 *
	 * @param string $key    License key
	 * @param string $domain Domain to activate on
	 * @return array Activation result
	 */
	public function activate( $key, $domain ) {
		if ( ! $this->isValidFormat( $key ) ) {
			return array(
				'success' => false,
				'message' => __( 'Invalid license key format.', 'subtleforms' ),
			);
		}

		$result = $this->callApi( 'activate', array(
			'key'    => $key,
			'domain' => $domain,
			'ip'     => $this->getCurrentIp(),
		) );

		// Clear validation cache on activation
		$cache_key = 'subtleforms_license_check_' . md5( $key . $domain );
		delete_transient( $cache_key );

		return $result;
	}

	/**
	 * Deactivate license
	 *
	 * @param string $key    License key
	 * @param string $domain Domain to deactivate from
	 * @return array Deactivation result
	 */
	public function deactivate( $key, $domain ) {
		$result = $this->callApi( 'deactivate', array(
			'key'    => $key,
			'domain' => $domain,
		) );

		// Clear validation cache on deactivation
		$cache_key = 'subtleforms_license_check_' . md5( $key . $domain );
		delete_transient( $cache_key );

		return $result;
	}

	/**
	 * Check if license key format is valid
	 *
	 * Format: XXXX-XXXX-XXXX-XXXX (4 groups of 4 alphanumeric characters)
	 *
	 * @param string $key License key
	 * @return bool
	 */
	private function isValidFormat( $key ) {
		// Remove hyphens for validation
		$clean_key = str_replace( '-', '', $key );

		// Must be 16 alphanumeric characters
		return (bool) preg_match( '/^[A-Z0-9]{16}$/', $clean_key );
	}

	/**
	 * Call license server API
	 *
	 * @param string $endpoint API endpoint
	 * @param array  $data     Request data
	 * @return array Response data
	 */
	private function callApi( $endpoint, $data ) {
		$url = trailingslashit( self::LICENSE_SERVER_URL ) . 'licenses/' . $endpoint;

		// Add product identifier
		$data['product_id'] = 'subtleforms';
		$data['version']    = SUBTLEFORMS_VERSION ?? '1.0.0';

		$response = wp_remote_post( $url, array(
			'timeout' => self::API_TIMEOUT,
			'headers' => array(
				'Content-Type' => 'application/json',
				'Accept'       => 'application/json',
			),
			'body'    => wp_json_encode( $data ),
		) );

		// Handle API errors
		if ( is_wp_error( $response ) ) {
			return $this->handleApiError( $response );
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = wp_remote_retrieve_body( $response );
		$result      = json_decode( $body, true );

		// Handle HTTP errors
		if ( $status_code < 200 || $status_code >= 300 ) {
			return $this->handleHttpError( $status_code, $result );
		}

		// Return successful result
		return $result;
	}

	/**
	 * Handle API error (network/timeout)
	 *
	 * @param \WP_Error $error WP Error object
	 * @return array Error response
	 */
	private function handleApiError( $error ) {
		// Log error for debugging
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			Logger::error( 'License API Error: ' . $error->get_error_message() );
		}

		return array(
			'success' => false,
			'status'  => LicenseManager::STATUS_INVALID,
			'message' => sprintf(
				/* translators: %s: error message */
				__( 'Could not connect to license server: %s', 'subtleforms' ),
				$error->get_error_message()
			),
		);
	}

	/**
	 * Handle HTTP error response
	 *
	 * @param int   $status_code HTTP status code
	 * @param array $result      Decoded response
	 * @return array Error response
	 */
	private function handleHttpError( $status_code, $result ) {
		$default_message = __( 'License validation failed.', 'subtleforms' );
		$message         = $result['message'] ?? $default_message;

		// Map HTTP status codes to license statuses
		$status_map = array(
			400 => LicenseManager::STATUS_INVALID,  // Bad request
			401 => LicenseManager::STATUS_INVALID,  // Unauthorized
			403 => LicenseManager::STATUS_EXPIRED,  // Forbidden (expired)
			404 => LicenseManager::STATUS_INVALID,  // Not found
			429 => LicenseManager::STATUS_INVALID,  // Rate limited
		);

		$status = $status_map[ $status_code ] ?? LicenseManager::STATUS_INVALID;

		return array(
			'success' => false,
			'status'  => $status,
			'message' => $message,
		);
	}

	/**
	 * Get current IP address
	 *
	 * @return string
	 */
	private function getCurrentIp() {
		$ip = '';

		// Check various headers for IP
		$headers = array(
			'HTTP_CF_CONNECTING_IP', // Cloudflare
			'HTTP_X_FORWARDED_FOR',
			'HTTP_X_REAL_IP',
			'REMOTE_ADDR',
		);

		foreach ( $headers as $header ) {
			if ( ! empty( $_SERVER[ $header ] ) ) {
				$ip = sanitize_text_field( wp_unslash( $_SERVER[ $header ] ) );
				// Get first IP if comma-separated
				if ( strpos( $ip, ',' ) !== false ) {
					$ips = explode( ',', $ip );
					$ip  = trim( $ips[0] );
				}
				break;
			}
		}

		return $ip;
	}
}
