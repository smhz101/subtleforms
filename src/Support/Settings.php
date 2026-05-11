<?php

namespace SubtleForms\Support;

/**
 * Settings Manager
 *
 * Handles plugin settings storage, retrieval, and validation.
 */
class Settings {

	/**
	 * Option name in wp_options table
	 */
	const OPTION_NAME = 'subtleforms_settings';

	/**
	 * Default settings
	 */
	const DEFAULTS = array(
		// General
		'default_form_status'        => 'draft',
		'autosave_enabled'           => true,
		'autosave_interval'          => 3,
		'delete_behavior'            => 'soft',

		// Frontend
		'success_message'            => 'Thank you! Your submission has been received.',
		'error_message'              => 'An error occurred. Please try again.',
		'redirect_after_submit'      => '',
		'submission_limit_enabled'   => false,
		'submission_limit'           => 1,

		// Email / Notifications
		'admin_notification_enabled' => true,
		'user_confirmation_enabled'  => false,
		'sender_name'                => '',
		'sender_email'               => '',
		'admin_email'                => '',

		// Advanced
		'debug_mode'                 => false,

		// Spam Protection
		'enable_honeypot'            => true,
		'min_submission_time'        => 3,

		// CAPTCHA
		'captcha_enabled'            => false,
		'captcha_provider'           => '', // Deprecated: kept for backwards compatibility
		'captcha_recaptcha_enabled'  => false,
		'captcha_recaptcha_site_key' => '',
		'captcha_recaptcha_secret_key' => '',
		'captcha_recaptcha_version'  => 'v2',
		'captcha_hcaptcha_enabled'   => false,
		'captcha_hcaptcha_site_key'  => '',
		'captcha_hcaptcha_secret_key' => '',
		'captcha_turnstile_enabled'  => false,
		'captcha_turnstile_site_key' => '',
		'captcha_turnstile_secret_key' => '',

		// Privacy & GDPR
		'data_retention_days'        => 0, // 0 = keep forever

		// ── Extensions ───────────────────────────────────────────────────────

		// Webhooks
		'ext_webhooks_enabled'              => false,
		'ext_webhooks_signing_secret'       => '',
		'ext_webhooks_events'               => array( 'submission.created' ),

		// Email Marketing
		'ext_email_marketing_enabled'       => false,
		'ext_email_marketing_provider'      => 'mailchimp', // mailchimp|convertkit
		'ext_email_marketing_api_key'       => '',
		'ext_email_marketing_list_id'       => '',
		'ext_email_marketing_double_optin'  => false,

		// CRM (HubSpot)
		'ext_crm_enabled'                   => false,
		'ext_crm_provider'                  => 'hubspot',
		'ext_crm_api_key'                   => '',
		'ext_crm_portal_id'                 => '',

		// Analytics
		'ext_analytics_enabled'             => false,
		'ext_analytics_view_tracking'       => true,
		'ext_analytics_retention_days'      => 90,

		// E-commerce (WooCommerce)
		'ext_ecommerce_enabled'             => false,
		'ext_ecommerce_product_id'          => 0,
		'ext_ecommerce_currency'            => 'USD',

		// PDF Generation
		'ext_pdf_enabled'                   => false,
		'ext_pdf_template'                  => 'default',
		'ext_pdf_attach_to_email'           => false,

		// Multilanguage
		'ext_multilanguage_enabled'         => false,
		'ext_multilanguage_provider'        => 'wpml', // wpml|polylang

		// Payments (Stripe / PayPal)
		'ext_payments_enabled'              => false,
		'ext_payments_provider'             => 'stripe', // stripe|paypal
		'ext_payments_stripe_pk'            => '',
		'ext_payments_stripe_sk'            => '',
		'ext_payments_paypal_client_id'     => '',
		'ext_payments_paypal_client_secret' => '',
		'ext_payments_currency'             => 'USD',
		'ext_payments_mode'                 => 'test', // test|live
	);

	/**
	 * Validation rules for settings
	 */
	const VALIDATION_RULES = array(
		'default_form_status'        => array( 'draft', 'published' ),
		'autosave_enabled'           => 'boolean',
		'autosave_interval'          => array(
			'integer',
			'min' => 1,
			'max' => 60,
		),
		'delete_behavior'            => array( 'soft', 'hard' ),
		'success_message'            => array(
			'string',
			'max' => 500,
		),
		'error_message'              => array(
			'string',
			'max' => 500,
		),
		'redirect_after_submit'      => array(
			'string',
			'max' => 500,
		),
		'submission_limit_enabled'   => 'boolean',
		'submission_limit'           => array(
			'integer',
			'min' => 1,
			'max' => 100,
		),
		'admin_notification_enabled' => 'boolean',
		'user_confirmation_enabled'  => 'boolean',
		'sender_name'                => array(
			'string',
			'max' => 100,
		),
		'sender_email'               => 'email',
		'admin_email'                => 'email',
		'debug_mode'                 => 'boolean',
		'captcha_enabled'            => 'boolean',
		'captcha_provider'           => array( '', 'recaptcha', 'hcaptcha', 'turnstile' ), // Deprecated
		'captcha_recaptcha_enabled'  => 'boolean',
		'captcha_recaptcha_site_key' => array(
			'string',
			'max' => 200,
		),
		'captcha_recaptcha_secret_key' => array(
			'string',
			'max' => 200,
		),
		'captcha_recaptcha_version'  => array( 'v2', 'v3' ),
		'captcha_hcaptcha_enabled'   => 'boolean',
		'captcha_hcaptcha_site_key'  => array(
			'string',
			'max' => 200,
		),
		'captcha_hcaptcha_secret_key' => array(
			'string',
			'max' => 200,
		),
		'captcha_turnstile_enabled'  => 'boolean',
		'captcha_turnstile_site_key' => array(
			'string',
			'max' => 200,
		),
		'captcha_turnstile_secret_key' => array(
			'string',
			'max' => 200,
		),
		'enable_honeypot'            => 'boolean',
		'min_submission_time'        => array(
			'integer',
			'min' => 0,
			'max' => 60,
		),
		'data_retention_days'        => array(
			'integer',
			'min' => 0,
			'max' => 3650,
		),

		// Extensions
		'ext_webhooks_enabled'              => 'boolean',
		'ext_webhooks_signing_secret'       => array( 'string', 'max' => 200 ),
		'ext_webhooks_events'               => 'array',
		'ext_email_marketing_enabled'       => 'boolean',
		'ext_email_marketing_provider'      => array( 'mailchimp', 'convertkit' ),
		'ext_email_marketing_api_key'       => array( 'string', 'max' => 500 ),
		'ext_email_marketing_list_id'       => array( 'string', 'max' => 200 ),
		'ext_email_marketing_double_optin'  => 'boolean',
		'ext_crm_enabled'                   => 'boolean',
		'ext_crm_provider'                  => array( 'hubspot' ),
		'ext_crm_api_key'                   => array( 'string', 'max' => 500 ),
		'ext_crm_portal_id'                 => array( 'string', 'max' => 100 ),
		'ext_analytics_enabled'             => 'boolean',
		'ext_analytics_view_tracking'       => 'boolean',
		'ext_analytics_retention_days'      => array( 'integer', 'min' => 1, 'max' => 3650 ),
		'ext_ecommerce_enabled'             => 'boolean',
		'ext_ecommerce_product_id'          => array( 'integer', 'min' => 0 ),
		'ext_ecommerce_currency'            => array( 'string', 'max' => 10 ),
		'ext_pdf_enabled'                   => 'boolean',
		'ext_pdf_template'                  => array( 'string', 'max' => 100 ),
		'ext_pdf_attach_to_email'           => 'boolean',
		'ext_multilanguage_enabled'         => 'boolean',
		'ext_multilanguage_provider'        => array( 'wpml', 'polylang' ),
		'ext_payments_enabled'              => 'boolean',
		'ext_payments_provider'             => array( 'stripe', 'paypal' ),
		'ext_payments_stripe_pk'            => array( 'string', 'max' => 500 ),
		'ext_payments_stripe_sk'            => array( 'string', 'max' => 500 ),
		'ext_payments_paypal_client_id'     => array( 'string', 'max' => 500 ),
		'ext_payments_paypal_client_secret' => array( 'string', 'max' => 500 ),
		'ext_payments_currency'             => array( 'string', 'max' => 10 ),
		'ext_payments_mode'                 => array( 'test', 'live' ),
	);

	/**
	 * Get all settings
	 *
	 * @return array
	 */
	public function getAll() {
		$settings = get_option( self::OPTION_NAME, array() );
		return wp_parse_args( $settings, self::DEFAULTS );
	}

	/**
	 * Get a specific setting
	 *
	 * @param string $key Setting key
	 * @param mixed  $default Default value if not found
	 * @return mixed
	 */
	public function get( $key, $default = null ) {
		$settings = $this->getAll();

		if ( isset( $settings[ $key ] ) ) {
			return $settings[ $key ];
		}

		return $default !== null ? $default : ( self::DEFAULTS[ $key ] ?? null );
	}

	/**
	 * Update settings
	 *
	 * @param array $newSettings New settings to merge
	 * @return bool
	 */
	public function update( $newSettings ) {
		$currentSettings = $this->getAll();
		$mergedSettings  = array_merge( $currentSettings, $newSettings );

		// Validate settings
		$validatedSettings = $this->validate( $mergedSettings );

		return update_option( self::OPTION_NAME, $validatedSettings );
	}

	/**
	 * Reset settings to defaults
	 *
	 * @return bool
	 */
	public function reset() {
		return update_option( self::OPTION_NAME, self::DEFAULTS );
	}

	/**
	 * Validate settings
	 *
	 * @param array $settings Settings to validate
	 * @return array Validated settings
	 * @throws \InvalidArgumentException If validation fails
	 */
	public function validate( $settings ) {
		$validated = array();

		foreach ( $settings as $key => $value ) {
			if ( ! isset( self::VALIDATION_RULES[ $key ] ) ) {
				continue;
			}

			$rule = self::VALIDATION_RULES[ $key ];

			// Handle type validation
			if ( is_string( $rule ) ) {
				$validated[ $key ] = $this->validateType( $key, $value, $rule );
				continue;
			}

			// Handle complex validation rules with type and constraints
			if ( is_array( $rule ) && isset( $rule[0] ) && ( isset( $rule['min'] ) || isset( $rule['max'] ) ) ) {
				$validated[ $key ] = $this->validateWithRules( $key, $value, $rule );
				continue;
			}

			// Handle array of allowed values (enum)
			if ( is_array( $rule ) && isset( $rule[0] ) ) {
				if ( ! in_array( $value, $rule, true ) ) {
					throw new \InvalidArgumentException( "Invalid value for {$key}" ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				$validated[ $key ] = $value;
				continue;
			}
		}

		return $validated;
	}

	/**
	 * Validate by type
	 *
	 * @param string $key Setting key
	 * @param mixed  $value Value to validate
	 * @param string $type Type to validate against
	 * @return mixed Validated value
	 * @throws \InvalidArgumentException If validation fails
	 */
	private function validateType( $key, $value, $type ) {
		switch ( $type ) {
			case 'boolean':
				// Handle various boolean representations
				if ( is_bool( $value ) ) {
					return $value;
				}
				if ( is_string( $value ) ) {
					return filter_var( $value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE ) ?? false;
				}
				return (bool) $value;

			case 'integer':
				if ( ! is_numeric( $value ) ) {
					throw new \InvalidArgumentException( "{$key} must be an integer" ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return (int) $value;

			case 'string':
				return sanitize_text_field( $value );

			case 'email':
				if ( ! empty( $value ) && ! is_email( $value ) ) {
					throw new \InvalidArgumentException( "{$key} must be a valid email" ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return sanitize_email( $value );

			default:
				return $value;
		}
	}

	/**
	 * Validate with complex rules
	 *
	 * @param string $key Setting key
	 * @param mixed  $value Value to validate
	 * @param array  $rules Validation rules
	 * @return mixed Validated value
	 * @throws \InvalidArgumentException If validation fails
	 */
	private function validateWithRules( $key, $value, $rules ) {
		$type      = $rules[0] ?? 'string';
		$validated = $this->validateType( $key, $value, $type );

		// Check min value
		if ( isset( $rules['min'] ) && $validated < $rules['min'] ) {
			throw new \InvalidArgumentException( "{$key} must be at least {$rules['min']}" ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		// Check max value
		if ( isset( $rules['max'] ) ) {
			if ( $type === 'string' && strlen( $validated ) > $rules['max'] ) {
				throw new \InvalidArgumentException( "{$key} must be at most {$rules['max']} characters" ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
			if ( $type === 'integer' && $validated > $rules['max'] ) {
				throw new \InvalidArgumentException( "{$key} must be at most {$rules['max']}" ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
		}

		return $validated;
	}

	/**
	 * Get sender email with fallback to admin email
	 *
	 * @return string
	 */
	public function getSenderEmail() {
		$email = $this->get( 'sender_email' );
		return ! empty( $email ) ? $email : get_option( 'admin_email' );
	}

	/**
	 * Get sender name with fallback to site name
	 *
	 * @return string
	 */
	public function getSenderName() {
		$name = $this->get( 'sender_name' );
		return ! empty( $name ) ? $name : get_option( 'blogname' );
	}

	/**
	 * Get admin email with fallback to WordPress admin email
	 *
	 * @return string
	 */
	public function getAdminEmail() {
		$email = $this->get( 'admin_email' );
		return ! empty( $email ) ? $email : get_option( 'admin_email' );
	}
}
