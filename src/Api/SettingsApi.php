<?php

namespace SubtleForms\Api;

use SubtleForms\Support\Settings;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Settings API
 *
 * REST API endpoints for plugin settings.
 */
class SettingsApi {

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * Constructor
	 *
	 * @param Settings $settings Settings manager
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Register routes
	 */
	public function registerRoutes() {
		register_rest_route(
			'subtleforms/v1',
			'/settings',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'getSettings' ),
					'permission_callback' => array( $this, 'checkPermissions' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'updateSettings' ),
					'permission_callback' => array( $this, 'checkPermissions' ),
					'args'                => $this->getUpdateArgs(),
				),
			)
		);

		register_rest_route(
			'subtleforms/v1',
			'/settings/reset',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'resetSettings' ),
				'permission_callback' => array( $this, 'checkPermissions' ),
			)
		);
	}

	/**
	 * Get settings
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function getSettings( WP_REST_Request $request ) {
		try {
			$settings = $this->settings->getAll();

			return new WP_REST_Response(
				array(
					'success' => true,
					'data'    => $settings,
				),
				200
			);
		} catch ( \Exception $e ) {
			return new WP_Error(
				'settings_error',
				$e->getMessage(),
				array( 'status' => 500 )
			);
		}
	}

	/**
	 * Update settings
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function updateSettings( WP_REST_Request $request ) {
		try {
			$newSettings = $request->get_json_params();

			if ( empty( $newSettings ) || ! is_array( $newSettings ) ) {
				return new WP_Error(
					'invalid_settings',
					'Invalid settings data',
					array( 'status' => 400 )
				);
			}

			$this->settings->update( $newSettings );
			$updatedSettings = $this->settings->getAll();

			return new WP_REST_Response(
				array(
					'success' => true,
					'message' => 'Settings updated successfully',
					'data'    => $updatedSettings,
				),
				200
			);
		} catch ( \InvalidArgumentException $e ) {
			return new WP_Error(
				'validation_error',
				$e->getMessage(),
				array( 'status' => 400 )
			);
		} catch ( \Exception $e ) {
			return new WP_Error(
				'settings_error',
				'Failed to update settings: ' . $e->getMessage(),
				array( 'status' => 500 )
			);
		}
	}

	/**
	 * Reset settings to defaults
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function resetSettings( WP_REST_Request $request ) {
		try {
			$this->settings->reset();
			$settings = $this->settings->getAll();

			return new WP_REST_Response(
				array(
					'success' => true,
					'message' => 'Settings reset to defaults',
					'data'    => $settings,
				),
				200
			);
		} catch ( \Exception $e ) {
			return new WP_Error(
				'settings_error',
				'Failed to reset settings: ' . $e->getMessage(),
				array( 'status' => 500 )
			);
		}
	}

	/**
	 * Check permissions
	 *
	 * @return bool
	 */
	public function checkPermissions() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Get update arguments schema
	 *
	 * @return array
	 */
	private function getUpdateArgs() {
		return array(
			'default_form_status'        => array(
				'type'              => 'string',
				'enum'              => array( 'draft', 'published' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'autosave_enabled'           => array(
				'type' => 'boolean',
			),
			'autosave_interval'          => array(
				'type'              => 'integer',
				'minimum'           => 1,
				'maximum'           => 60,
				'validate_callback' => function ( $value, $request, $key ) {
					if ( ! is_numeric( $value ) ) {
						return new \WP_Error( 'rest_invalid_param', 'autosave_interval must be a number', array( 'status' => 400 ) );
					}
					$int_value = intval( $value );
					if ( $int_value < 1 || $int_value > 60 ) {
						return new \WP_Error( 'rest_invalid_param', 'autosave_interval must be between 1 and 60', array( 'status' => 400 ) );
					}
					return true;
				},
			),
			'delete_behavior'            => array(
				'type'              => 'string',
				'enum'              => array( 'soft', 'hard' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'success_message'            => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'error_message'              => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'redirect_after_submit'      => array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
			),
			'submission_limit_enabled'   => array(
				'type' => 'boolean',
			),
			'submission_limit'           => array(
				'type'              => 'integer',
				'minimum'           => 1,
				'maximum'           => 100,
				'validate_callback' => function ( $value, $request, $key ) {
					if ( ! is_numeric( $value ) ) {
						return new \WP_Error( 'rest_invalid_param', 'submission_limit must be a number', array( 'status' => 400 ) );
					}
					$int_value = intval( $value );
					if ( $int_value < 1 || $int_value > 100 ) {
						return new \WP_Error( 'rest_invalid_param', 'submission_limit must be between 1 and 100', array( 'status' => 400 ) );
					}
					return true;
				},
			),
			// Spam protection
			'enable_honeypot'           => array(
				'type' => 'boolean',
			),
			'min_submission_time'       => array(
				'type'    => 'integer',
				'minimum' => 1,
				'maximum' => 300,
			),
			'admin_notification_enabled' => array(
				'type' => 'boolean',
			),
			'user_confirmation_enabled'  => array(
				'type' => 'boolean',
			),
			'sender_name'                => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'sender_email'               => array(
				'type'              => 'string',
				'format'            => 'email',
				'sanitize_callback' => 'sanitize_email',
			),
			'admin_email'                => array(
				'type'              => 'string',
				'format'            => 'email',
				'sanitize_callback' => 'sanitize_email',
			),
			'debug_mode'                 => array(
				'type' => 'boolean',
			),
			'log_retention_days'         => array(
				'type'              => 'integer',
				'minimum'           => 1,
				'maximum'           => 365,
				'validate_callback' => function ( $value, $request, $key ) {
					if ( ! is_numeric( $value ) ) {
						return new \WP_Error( 'rest_invalid_param', 'log_retention_days must be a number', array( 'status' => 400 ) );
					}
					$int_value = intval( $value );
					if ( $int_value < 1 || $int_value > 365 ) {
						return new \WP_Error( 'rest_invalid_param', 'log_retention_days must be between 1 and 365', array( 'status' => 400 ) );
					}
					return true;
				},
			),
		);
	}
}
