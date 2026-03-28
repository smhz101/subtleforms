<?php
/**
 * SubtleForms Subscription Manager
 *
 * Manages the connection between the plugin and the subtleforms.com
 * subscription service. Handles license activation, status checks, and
 * translates subscription plans into capability overrides.
 *
 * ## Dev Mode
 * Define SUBTLEFORMS_DEV_LICENSE as true in wp-config.php to unlock all
 * capabilities locally without making any API calls.
 *
 * @package SubtleForms\Licensing
 * @since   2.1.0
 */

namespace SubtleForms\Licensing;

/**
 * Subscription manager for the subtleforms.com subscription service.
 */
class SubscriptionManager {

	/**
	 * WP option key for the connected account email.
	 */
	const OPTION_EMAIL = 'subtleforms_subscription_email';

	/**
	 * WP option key for the stored license/API token.
	 */
	const OPTION_TOKEN = 'subtleforms_subscription_token';

	/**
	 * WP option key for cached subscription data (status, plan, expiry).
	 */
	const OPTION_DATA = 'subtleforms_subscription_data';

	/**
	 * Base URL for the subtleforms.com license API.
	 */
	const API_BASE = 'https://api.subtleforms.com/v1';

	/**
	 * Whether dev/dummy mode is active.
	 *
	 * Set SUBTLEFORMS_DEV_LICENSE = true in wp-config.php to enable.
	 *
	 * @return bool
	 */
	public function isDev(): bool {
		return defined( 'SUBTLEFORMS_DEV_LICENSE' ) && SUBTLEFORMS_DEV_LICENSE;
	}

	/**
	 * Activate a license and store the result.
	 *
	 * In dev mode no API call is made — the provided email is stored and
	 * the response always reports an active Pro license.
	 *
	 * @param string $email      Account email address.
	 * @param string $licenseKey License key from the purchase confirmation.
	 * @return array{success: bool, status?: string, plan?: string, error?: string}
	 */
	public function connect( string $email, string $licenseKey ): array {
		$email = sanitize_email( $email );

		if ( $this->isDev() ) {
			update_option( self::OPTION_EMAIL, $email );
			update_option(
				self::OPTION_DATA,
				array(
					'status'  => 'active',
					'plan'    => 'pro',
					'dev'     => true,
					'expires' => null,
				)
			);
			return array( 'success' => true, 'status' => 'active', 'plan' => 'pro' );
		}

		$response = wp_remote_post(
			self::API_BASE . '/license/activate',
			array(
				'body'    => wp_json_encode(
					array(
						'email'       => $email,
						'license_key' => $licenseKey,
						'site_url'    => home_url(),
					)
				),
				'headers' => array(
					'Content-Type' => 'application/json',
					'Accept'       => 'application/json',
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array( 'success' => false, 'error' => $response->get_error_message() );
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $data ) ) {
			return array( 'success' => false, 'error' => __( 'Invalid response from license server.', 'subtleforms' ) );
		}

		if ( ( $data['status'] ?? '' ) === 'active' ) {
			update_option( self::OPTION_EMAIL, $email );
			update_option( self::OPTION_TOKEN, sanitize_text_field( $data['token'] ?? '' ) );
			update_option( self::OPTION_DATA, $data );
			return array_merge( $data, array( 'success' => true ) );
		}

		$errorMessage = $data['message'] ?? $data['error'] ?? __( 'License activation failed.', 'subtleforms' );
		return array( 'success' => false, 'error' => $errorMessage, 'status' => $data['status'] ?? '' );
	}

	/**
	 * Deactivate the license and clear stored credentials.
	 *
	 * @return void
	 */
	public function disconnect(): void {
		$token = get_option( self::OPTION_TOKEN, '' );

		// Best-effort deactivation call — ignore errors.
		if ( $token && ! $this->isDev() ) {
			wp_remote_post(
				self::API_BASE . '/license/deactivate',
				array(
					'body'    => wp_json_encode(
						array(
							'token'    => $token,
							'site_url' => home_url(),
						)
					),
					'headers' => array(
						'Content-Type' => 'application/json',
					),
					'timeout' => 10,
					'blocking' => false,
				)
			);
		}

		delete_option( self::OPTION_EMAIL );
		delete_option( self::OPTION_TOKEN );
		delete_option( self::OPTION_DATA );
	}

	/**
	 * Get the current subscription status.
	 *
	 * @return string One of 'active', 'inactive', 'expired', 'invalid', 'grace_period'.
	 */
	public function getStatus(): string {
		if ( $this->isDev() ) {
			return 'active';
		}
		$data = (array) get_option( self::OPTION_DATA, array() );
		return (string) ( $data['status'] ?? 'inactive' );
	}

	/**
	 * Get the current subscription plan slug.
	 *
	 * @return string One of 'free', 'starter', 'pro', 'agency'.
	 */
	public function getPlan(): string {
		if ( $this->isDev() ) {
			return 'pro';
		}
		$data = (array) get_option( self::OPTION_DATA, array() );
		return (string) ( $data['plan'] ?? 'free' );
	}

	/**
	 * Get subscription expiry date string, or null if none.
	 *
	 * @return string|null
	 */
	public function getExpiresAt(): ?string {
		if ( $this->isDev() ) {
			return null;
		}
		$data = (array) get_option( self::OPTION_DATA, array() );
		$expires = $data['expires'] ?? null;
		return $expires ? (string) $expires : null;
	}

	/**
	 * Get the connected account email address.
	 *
	 * @return string
	 */
	public function getEmail(): string {
		return (string) get_option( self::OPTION_EMAIL, '' );
	}

	/**
	 * Whether the subscription is currently active.
	 *
	 * @return bool
	 */
	public function isActive(): bool {
		return in_array( $this->getStatus(), array( 'active', 'grace_period' ), true );
	}

	/**
	 * Get the full subscription data for JS exposure.
	 *
	 * @return array
	 */
	public function toArray(): array {
		return array(
			'status'    => $this->getStatus(),
			'plan'      => $this->getPlan(),
			'email'     => $this->getEmail(),
			'expiresAt' => $this->getExpiresAt(),
			'isDev'     => $this->isDev(),
			'connected' => $this->isActive(),
		);
	}

	/**
	 * Get capability overrides for the active subscription.
	 *
	 * Returns an empty array when no active subscription is present so that
	 * all capabilities remain at their freemium defaults.
	 *
	 * @return array<string,bool>
	 */
	public function getCapabilities(): array {
		if ( $this->isDev() ) {
			return $this->capabilitiesForPlan( 'pro' );
		}

		if ( ! $this->isActive() ) {
			return array();
		}

		return $this->capabilitiesForPlan( $this->getPlan() );
	}

	/**
	 * Build the capability map for a given plan.
	 *
	 * @param string $plan Plan slug.
	 * @return array<string,bool>
	 */
	private function capabilitiesForPlan( string $plan ): array {
		if ( in_array( $plan, array( 'pro', 'agency' ), true ) ) {
			return array(
				'logic.conditional.advanced' => true,
				'pipeline.retry'             => true,
				'pipeline.delay'             => true,
				'actions.payment'            => true,
				'extensions.custom'          => true,
				'extensions.webhooks'        => true,
				'extensions.email_marketing' => true,
				'extensions.crm'             => true,
				'extensions.analytics'       => true,
				'extensions.ecommerce'       => true,
				'extensions.pdf'             => true,
				'extensions.multilanguage'   => true,
				'extensions.payments'        => true,
				'templates.pro'              => true,
				'submissions.export'         => true,
			);
		}

		if ( $plan === 'starter' ) {
			return array(
				'extensions.webhooks'        => true,
				'extensions.email_marketing' => true,
				'extensions.analytics'       => true,
				'templates.pro'              => true,
				'logic.conditional.advanced' => true,
				'submissions.export'         => true,
			);
		}

		return array();
	}
}
