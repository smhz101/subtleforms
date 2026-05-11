<?php
/**
 * SubtleForms Fields & Templates REST API
 *
 * Field definitions and form template endpoints.
 *
 * @package SubtleForms\Api
 * @since   1.9.0
 */

namespace SubtleForms\Api;

use SubtleForms\Support\Logger;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Settings;
use SubtleForms\Fields\FieldRegistry;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST API controller for field definitions and form templates.
 */
final class FieldsApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FieldRegistry */
	private $fieldRegistry;

	/** @var FeatureGate */
	private $gate;

	/** @var Settings|null */
	private $settings;

	public function __construct(
		FieldRegistry $fieldRegistry,
		FeatureGate $gate,
		?Settings $settings = null
	) {
		$this->fieldRegistry = $fieldRegistry;
		$this->gate          = $gate;
		$this->settings      = $settings;
	}

	protected function getGate(): FeatureGate {
		return $this->gate;
	}

	/**
	 * Register REST API routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/fields',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_fields' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/templates',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_templates' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);
	}

	// ────────────────────────────────────────────────────────────────────
	// Handlers
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Get all registered field definitions.
	 */
	public function get_fields( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$grouped = $request->get_param( 'grouped' );
		Logger::debug( 'get_fields called with grouped=%s by user=%d', var_export( $grouped, true ), get_current_user_id() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions

		// Get CAPTCHA enabled states
		$captchaEnabled   = $this->settings ? (bool) $this->settings->get( 'captcha_enabled', false ) : false;
		$recaptchaEnabled = $this->settings ? (bool) $this->settings->get( 'captcha_recaptcha_enabled', false ) : false;
		$hcaptchaEnabled  = $this->settings ? (bool) $this->settings->get( 'captcha_hcaptcha_enabled', false ) : false;
		$turnstileEnabled = $this->settings ? (bool) $this->settings->get( 'captcha_turnstile_enabled', false ) : false;

		$canUsePayment = $this->gate->allows( 'actions.payment' );

		if ( $grouped === 'true' || $grouped === '1' ) {
			$fields = $this->fieldRegistry->byCategory();
			$fields = array_map(
				function ( $categoryFields ) use ( $captchaEnabled, $recaptchaEnabled, $hcaptchaEnabled, $turnstileEnabled, $canUsePayment ) {
					return array_map(
						function ( $field ) use ( $captchaEnabled, $recaptchaEnabled, $hcaptchaEnabled, $turnstileEnabled, $canUsePayment ) {
							$fieldArray = $field->toArray();

							if ( $field->type === 'recaptcha' ) {
								$fieldArray['enabled'] = $captchaEnabled && $recaptchaEnabled;
							} elseif ( $field->type === 'hcaptcha' ) {
								$fieldArray['enabled'] = $captchaEnabled && $hcaptchaEnabled;
							} elseif ( $field->type === 'turnstile' ) {
								$fieldArray['enabled'] = $captchaEnabled && $turnstileEnabled;
							} else {
								$fieldArray['enabled'] = true;
							}

							$fieldArray['is_pro']        = ! empty( $field->requiredCapabilities );
							$fieldArray['is_pro_locked'] = $fieldArray['is_pro'] && ! $canUsePayment;

							return $fieldArray;
						},
						$categoryFields
					);
				},
				$fields
			);
		} else {
			$fields = $this->fieldRegistry->toArray();
			$fields = array_map(
				function ( $fieldArray ) use ( $captchaEnabled, $recaptchaEnabled, $hcaptchaEnabled, $turnstileEnabled, $canUsePayment ) {
					if ( isset( $fieldArray['type'] ) ) {
						if ( $fieldArray['type'] === 'recaptcha' ) {
							$fieldArray['enabled'] = $captchaEnabled && $recaptchaEnabled;
						} elseif ( $fieldArray['type'] === 'hcaptcha' ) {
							$fieldArray['enabled'] = $captchaEnabled && $hcaptchaEnabled;
						} elseif ( $fieldArray['type'] === 'turnstile' ) {
							$fieldArray['enabled'] = $captchaEnabled && $turnstileEnabled;
						} else {
							$fieldArray['enabled'] = true;
						}
					}

					$fieldArray['is_pro']        = ! empty( $fieldArray['requiredCapabilities'] );
					$fieldArray['is_pro_locked'] = $fieldArray['is_pro'] && ! $canUsePayment;

					return $fieldArray;
				},
				$fields
			);
		}

		Logger::debug( 'get_fields response: %s', print_r( $fields, true ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions

		return ApiResponse::success( $fields );
	}

	/**
	 * Get form templates.
	 */
	public function get_templates( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$templates  = \SubtleForms\Templates\FormTemplates::get_all();
		$canUsePro  = $this->gate->allows( 'templates.pro' );

		// Always set is_locked explicitly on every template so the frontend has a
		// single authoritative source of truth (avoids stale JS capability state).
		$templates = array_map(
			function ( $tpl ) use ( $canUsePro ) {
				if ( ! empty( $tpl['is_pro'] ) ) {
					$tpl['is_locked'] = ! $canUsePro;
				} else {
					$tpl['is_locked'] = false;
				}
				return $tpl;
			},
			$templates
		);

		return ApiResponse::success(
			array(
				'success'   => true,
				'templates' => $templates,
			)
		);
	}
}
