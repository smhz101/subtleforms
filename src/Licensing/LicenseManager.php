<?php

namespace SubtleForms\Licensing;

use SubtleForms\Support\Settings;

/**
 * License Manager
 *
 * Handles license key storage, validation, and status management.
 * Implements domain binding and activation limits.
 *
 * @package SubtleForms\Licensing
 * @since 2.0.0
 */
class LicenseManager {

	/**
	 * License option key
	 */
	const LICENSE_KEY_OPTION = 'subtleforms_license_key';

	/**
	 * License data option key
	 */
	const LICENSE_DATA_OPTION = 'subtleforms_license_data';

	/**
	 * Grace period option key
	 */
	const GRACE_PERIOD_OPTION = 'subtleforms_license_grace_period';

	/**
	 * License statuses
	 */
	const STATUS_VALID = 'valid';
	const STATUS_INVALID = 'invalid';
	const STATUS_EXPIRED = 'expired';
	const STATUS_INACTIVE = 'inactive';
	const STATUS_GRACE_PERIOD = 'grace_period';

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * @var LicenseValidator
	 */
	private $validator;

	/**
	 * Cached license data
	 *
	 * @var array|null
	 */
	private $license_cache = null;

	/**
	 * Constructor
	 *
	 * @param Settings         $settings  Settings manager
	 * @param LicenseValidator $validator License validator
	 */
	public function __construct( Settings $settings, LicenseValidator $validator ) {
		$this->settings  = $settings;
		$this->validator = $validator;
	}

	/**
	 * Get the current license key
	 *
	 * @return string|null
	 */
	public function getLicenseKey() {
		return get_option( self::LICENSE_KEY_OPTION, null );
	}

	/**
	 * Set license key
	 *
	 * @param string $key License key
	 * @return bool
	 */
	public function setLicenseKey( $key ) {
		$key = $this->sanitizeLicenseKey( $key );

		if ( empty( $key ) ) {
			return $this->deactivate();
		}

		update_option( self::LICENSE_KEY_OPTION, $key );
		$this->clearCache();

		return true;
	}

	/**
	 * Get license data
	 *
	 * @param bool $force Force refresh from server
	 * @return array
	 */
	public function getLicenseData( $force = false ) {
		// Return cached data if available
		if ( ! $force && null !== $this->license_cache ) {
			return $this->license_cache;
		}

		$key = $this->getLicenseKey();

		// No license key set
		if ( empty( $key ) ) {
			return $this->getDefaultLicenseData();
		}

		// Get cached license data
		$cached_data = get_option( self::LICENSE_DATA_OPTION, array() );

		// Validate cache freshness (24 hours)
		if ( ! $force && isset( $cached_data['checked_at'] ) ) {
			$cache_age = time() - $cached_data['checked_at'];
			if ( $cache_age < DAY_IN_SECONDS ) {
				$this->license_cache = $cached_data;
				return $cached_data;
			}
		}

		// Validate license with remote server
		$validation_result = $this->validator->validate( $key, $this->getCurrentDomain() );

		$license_data = array(
			'key'         => $key,
			'status'      => $validation_result['status'],
			'expires_at'  => $validation_result['expires_at'] ?? null,
			'plan'        => $validation_result['plan'] ?? 'free',
			'domain'      => $this->getCurrentDomain(),
			'activations' => $validation_result['activations'] ?? 0,
			'limit'       => $validation_result['limit'] ?? 1,
			'checked_at'  => time(),
		);

		// Handle grace period
		if ( $license_data['status'] === self::STATUS_EXPIRED ) {
			$grace_period = $this->getGracePeriodEnd();
			if ( $grace_period && time() < $grace_period ) {
				$license_data['status']           = self::STATUS_GRACE_PERIOD;
				$license_data['grace_period_end'] = $grace_period;
			}
		}

		update_option( self::LICENSE_DATA_OPTION, $license_data );
		$this->license_cache = $license_data;

		return $license_data;
	}

	/**
	 * Activate license
	 *
	 * @param string $key License key
	 * @return array Result array with success and message
	 */
	public function activate( $key ) {
		$key = $this->sanitizeLicenseKey( $key );

		if ( empty( $key ) ) {
			return array(
				'success' => false,
				'message' => __( 'Invalid license key format.', 'subtleforms' ),
			);
		}

		// Validate with remote server
		$result = $this->validator->activate( $key, $this->getCurrentDomain() );

		if ( ! $result['success'] ) {
			return $result;
		}

		// Store license key
		$this->setLicenseKey( $key );

		// Store license data
		$license_data = array(
			'key'         => $key,
			'status'      => self::STATUS_VALID,
			'expires_at'  => $result['expires_at'] ?? null,
			'plan'        => $result['plan'] ?? 'pro',
			'domain'      => $this->getCurrentDomain(),
			'activations' => $result['activations'] ?? 1,
			'limit'       => $result['limit'] ?? 1,
			'checked_at'  => time(),
		);

		update_option( self::LICENSE_DATA_OPTION, $license_data );
		$this->clearCache();

		// Start grace period (7 days)
		$this->startGracePeriod();

		return array(
			'success' => true,
			'message' => __( 'License activated successfully!', 'subtleforms' ),
			'data'    => $license_data,
		);
	}

	/**
	 * Deactivate license
	 *
	 * @return bool
	 */
	public function deactivate() {
		$key = $this->getLicenseKey();

		if ( ! empty( $key ) ) {
			// Notify remote server
			$this->validator->deactivate( $key, $this->getCurrentDomain() );
		}

		// Clear license data
		delete_option( self::LICENSE_KEY_OPTION );
		delete_option( self::LICENSE_DATA_OPTION );
		delete_option( self::GRACE_PERIOD_OPTION );
		$this->clearCache();

		return true;
	}

	/**
	 * Check if license is valid
	 *
	 * @return bool
	 */
	public function isValid() {
		$data = $this->getLicenseData();

		return in_array(
			$data['status'],
			array( self::STATUS_VALID, self::STATUS_GRACE_PERIOD ),
			true
		);
	}

	/**
	 * Check if feature is available
	 *
	 * @param string $feature Feature key
	 * @return bool
	 */
	public function hasFeature( $feature ) {
		// If no valid license, only free features available
		if ( ! $this->isValid() ) {
			return $this->isFreeFeature( $feature );
		}

		$data = $this->getLicenseData();
		$plan = $data['plan'] ?? 'free';

		// Check feature availability by plan
		return $this->isFeatureAvailableForPlan( $feature, $plan );
	}

	/**
	 * Get license status
	 *
	 * @return string
	 */
	public function getStatus() {
		$data = $this->getLicenseData();
		return $data['status'] ?? self::STATUS_INACTIVE;
	}

	/**
	 * Get license plan
	 *
	 * @return string
	 */
	public function getPlan() {
		$data = $this->getLicenseData();
		return $data['plan'] ?? 'free';
	}

	/**
	 * Get expiration date
	 *
	 * @return int|null Unix timestamp or null
	 */
	public function getExpiresAt() {
		$data = $this->getLicenseData();
		return $data['expires_at'] ?? null;
	}

	/**
	 * Get days until expiration
	 *
	 * @return int|null Days or null if no expiration
	 */
	public function getDaysUntilExpiration() {
		$expires_at = $this->getExpiresAt();

		if ( ! $expires_at ) {
			return null;
		}

		$diff = $expires_at - time();
		return max( 0, (int) floor( $diff / DAY_IN_SECONDS ) );
	}

	/**
	 * Start grace period
	 *
	 * Grace period is 7 days after expiration
	 */
	private function startGracePeriod() {
		$grace_period_end = time() + ( 7 * DAY_IN_SECONDS );
		update_option( self::GRACE_PERIOD_OPTION, $grace_period_end );
	}

	/**
	 * Get grace period end timestamp
	 *
	 * @return int|null
	 */
	private function getGracePeriodEnd() {
		return get_option( self::GRACE_PERIOD_OPTION, null );
	}

	/**
	 * Get current domain
	 *
	 * @return string
	 */
	private function getCurrentDomain() {
		$url    = home_url();
		$parsed = wp_parse_url( $url );
		return $parsed['host'] ?? 'localhost';
	}

	/**
	 * Sanitize license key
	 *
	 * @param string $key Raw license key
	 * @return string Sanitized key
	 */
	private function sanitizeLicenseKey( $key ) {
		// Remove whitespace and standardize format
		$key = trim( $key );
		$key = strtoupper( $key );
		$key = preg_replace( '/[^A-Z0-9\-]/', '', $key );

		return $key;
	}

	/**
	 * Check if feature is free
	 *
	 * @param string $feature Feature key
	 * @return bool
	 */
	private function isFreeFeature( $feature ) {
		$free_features = array(
			'basic_forms',
			'standard_fields',
			'email_notifications',
			'entries_management',
			'export_csv',
		);

		return in_array( $feature, $free_features, true );
	}

	/**
	 * Check if feature is available for plan
	 *
	 * @param string $feature Feature key
	 * @param string $plan    Plan name
	 * @return bool
	 */
	private function isFeatureAvailableForPlan( $feature, $plan ) {
		$feature_matrix = array(
			'free'     => array(
				'basic_forms',
				'standard_fields',
				'email_notifications',
				'entries_management',
				'export_csv',
			),
			'pro'      => array(
				'basic_forms',
				'standard_fields',
				'email_notifications',
				'entries_management',
				'export_csv',
				'advanced_fields',
				'conditional_logic',
				'file_uploads',
				'payment_forms',
				'webhooks',
				'templates.pro',
				'ai_spam_detection',
				'ai_workflows',
				'ai_form_assist',
				'ai_routing',
			),
			'business' => array(
				// All Pro features plus:
				'multi_site',
				'white_label',
				'priority_support',
				'custom_integrations',
			),
		);

		// Business includes all Pro features
		if ( 'business' === $plan && isset( $feature_matrix['pro'] ) ) {
			return in_array( $feature, $feature_matrix['pro'], true ) ||
			       in_array( $feature, $feature_matrix['business'], true );
		}

		return isset( $feature_matrix[ $plan ] ) &&
		       in_array( $feature, $feature_matrix[ $plan ], true );
	}

	/**
	 * Get default license data
	 *
	 * @return array
	 */
	private function getDefaultLicenseData() {
		return array(
			'key'         => null,
			'status'      => self::STATUS_INACTIVE,
			'expires_at'  => null,
			'plan'        => 'free',
			'domain'      => $this->getCurrentDomain(),
			'activations' => 0,
			'limit'       => 0,
			'checked_at'  => null,
		);
	}

	/**
	 * Clear license cache
	 */
	private function clearCache() {
		$this->license_cache = null;
	}
}
