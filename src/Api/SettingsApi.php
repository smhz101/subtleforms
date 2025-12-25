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
class SettingsApi
{
    /**
     * @var Settings
     */
    private $settings;

    /**
     * Constructor
     * 
     * @param Settings $settings Settings manager
     */
    public function __construct(Settings $settings)
    {
        $this->settings = $settings;
    }

    /**
     * Register routes
     */
    public function registerRoutes()
    {
        register_rest_route('subtleforms/v1', '/settings', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'getSettings'],
                'permission_callback' => [$this, 'checkPermissions'],
            ],
            [
                'methods' => 'PUT',
                'callback' => [$this, 'updateSettings'],
                'permission_callback' => [$this, 'checkPermissions'],
                'args' => $this->getUpdateArgs(),
            ],
        ]);

        register_rest_route('subtleforms/v1', '/settings/reset', [
            'methods' => 'POST',
            'callback' => [$this, 'resetSettings'],
            'permission_callback' => [$this, 'checkPermissions'],
        ]);
    }

    /**
     * Get settings
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function getSettings(WP_REST_Request $request)
    {
        try {
            $settings = $this->settings->getAll();
            
            return new WP_REST_Response([
                'success' => true,
                'data' => $settings,
            ], 200);
        } catch (\Exception $e) {
            return new WP_Error(
                'settings_error',
                $e->getMessage(),
                ['status' => 500]
            );
        }
    }

    /**
     * Update settings
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function updateSettings(WP_REST_Request $request)
    {
        try {
            $newSettings = $request->get_json_params();
            
            if (empty($newSettings) || !is_array($newSettings)) {
                return new WP_Error(
                    'invalid_settings',
                    'Invalid settings data',
                    ['status' => 400]
                );
            }
            
            $this->settings->update($newSettings);
            $updatedSettings = $this->settings->getAll();
            
            return new WP_REST_Response([
                'success' => true,
                'message' => 'Settings updated successfully',
                'data' => $updatedSettings,
            ], 200);
        } catch (\InvalidArgumentException $e) {
            return new WP_Error(
                'validation_error',
                $e->getMessage(),
                ['status' => 400]
            );
        } catch (\Exception $e) {
            return new WP_Error(
                'settings_error',
                'Failed to update settings: ' . $e->getMessage(),
                ['status' => 500]
            );
        }
    }

    /**
     * Reset settings to defaults
     * 
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public function resetSettings(WP_REST_Request $request)
    {
        try {
            $this->settings->reset();
            $settings = $this->settings->getAll();
            
            return new WP_REST_Response([
                'success' => true,
                'message' => 'Settings reset to defaults',
                'data' => $settings,
            ], 200);
        } catch (\Exception $e) {
            return new WP_Error(
                'settings_error',
                'Failed to reset settings: ' . $e->getMessage(),
                ['status' => 500]
            );
        }
    }

    /**
     * Check permissions
     * 
     * @return bool
     */
    public function checkPermissions()
    {
        return current_user_can('manage_options');
    }

    /**
     * Get update arguments schema
     * 
     * @return array
     */
    private function getUpdateArgs()
    {
        return [
            'default_form_status' => [
                'type' => 'string',
                'enum' => ['draft', 'published'],
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'autosave_enabled' => [
                'type' => 'boolean',
            ],
            'autosave_interval' => [
                'type' => 'integer',
                'minimum' => 1,
                'maximum' => 60,
            ],
            'delete_behavior' => [
                'type' => 'string',
                'enum' => ['soft', 'hard'],
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'success_message' => [
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'error_message' => [
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'redirect_after_submit' => [
                'type' => 'string',
                'sanitize_callback' => 'esc_url_raw',
            ],
            'submission_limit_enabled' => [
                'type' => 'boolean',
            ],
            'submission_limit' => [
                'type' => 'integer',
                'minimum' => 1,
                'maximum' => 100,
            ],
            'admin_notification_enabled' => [
                'type' => 'boolean',
            ],
            'user_confirmation_enabled' => [
                'type' => 'boolean',
            ],
            'sender_name' => [
                'type' => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'sender_email' => [
                'type' => 'string',
                'format' => 'email',
                'sanitize_callback' => 'sanitize_email',
            ],
            'admin_email' => [
                'type' => 'string',
                'format' => 'email',
                'sanitize_callback' => 'sanitize_email',
            ],
            'debug_mode' => [
                'type' => 'boolean',
            ],
            'log_retention_days' => [
                'type' => 'integer',
                'minimum' => 1,
                'maximum' => 365,
            ],
        ];
    }
}
