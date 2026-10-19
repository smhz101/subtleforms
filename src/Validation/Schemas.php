<?php

/**
 * Validation Schemas
 *
 * Centralized validation schema definitions for all REST API endpoints.
 * Schemas are reusable across multiple endpoints and support nested validation.
 *
 * @package SubtleForms\Validation
 * @since 1.9.0 (Phase A2-P2)
 */

namespace SubtleForms\Validation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Schemas class
 *
 * Provides named validation schemas for REST API endpoints.
 * All schemas support allow-listing to prevent unexpected field writes.
 */
class Schemas {

	/**
	 * Form create schema
	 */
	const FORM_CREATE = 'FormCreate';

	/**
	 * Form update schema
	 */
	const FORM_UPDATE = 'FormUpdate';

	/**
	 * Form schema save
	 */
	const FORM_SCHEMA_SAVE = 'FormSchemaSave';

	/**
	 * Submission update schema
	 */
	const SUBMISSION_UPDATE = 'SubmissionUpdate';

	/**
	 * Public submit payload schema
	 */
	const PUBLIC_SUBMIT = 'PublicSubmit';

	/**
	 * Settings update schema
	 */
	const SETTINGS_UPDATE = 'SettingsUpdate';

	/**
	 * Get all validation schemas
	 *
	 * @return array<string,array> Named schemas
	 */
	public static function all(): array {
		return array(
			// Form Create
			self::FORM_CREATE => array(
				'__allow' => array( 'title', 'config', 'schema' ),
				'title'   => 'required|string|min:1|max:255',
				'config'  => 'optional|object|map:FormConfig',
				// Allow sending an initial schema during creation
				'schema'  => 'optional|object|map:FormSchema',
			),

			// Form Update
			self::FORM_UPDATE => array(
				'__allow' => array( 'title', 'status', 'config' ),
				'title'   => 'optional|string|min:1|max:255',
				'status'  => 'optional|in:draft,published,archived',
				'config'  => 'optional|object|map:FormConfig',
			),

			// Form Schema Save
			self::FORM_SCHEMA_SAVE => array(
				'__allow'  => array( 'schema', 'activate' ),
				'schema'   => 'required|object|map:FormSchema',
				'activate' => 'optional|bool|default:false',
			),

			// Submission Update (admin)
			self::SUBMISSION_UPDATE => array(
				'__allow' => array( 'status', 'is_read', 'notes', 'starred' ),
				'status'  => 'optional|in:spam,flagged,archived,none',
				'is_read' => 'optional|bool',
				'starred' => 'optional|bool',
				'notes'   => 'optional|string|max:500',
			),

			// Public Submit Payload
			self::PUBLIC_SUBMIT => array(
				'__allow'          => array( 'form_id', 'data', 'meta', 'website_url', 'form_rendered_at' ),
				'form_id'          => 'optional|int',
				'data'             => 'required|object',
				'meta'             => 'optional|object',
				'website_url'      => 'optional|string', // Honeypot
				'form_rendered_at' => 'optional|string', // Time trap
			),

			// Settings Update
			self::SETTINGS_UPDATE => array(
				'__allow'                      => array(
					// General
					'default_form_status',
					'autosave_enabled',
					'autosave_interval',
					'delete_behavior',
					'submissions_density',
					'submissions_reading_pane',
					// Frontend
					'success_message',
					'error_message',
					'redirect_after_submit',
					'submission_limit_enabled',
					'submission_limit',
					// Email / Notifications
					'admin_notification_enabled',
					'user_confirmation_enabled',
					'sender_name',
					'sender_email',
					'admin_email',
					// Advanced
					'debug_mode',
					// Spam Protection
					'enable_honeypot',
					'min_submission_time',
					// CAPTCHA
					'captcha_enabled',
					'captcha_provider',
					'captcha_type',
					'captcha_recaptcha_enabled',
					'captcha_hcaptcha_enabled',
					'captcha_turnstile_enabled',
					'captcha_site_key',
					'captcha_secret_key',
					'captcha_recaptcha_site_key',
					'captcha_recaptcha_secret_key',
					'captcha_recaptcha_version',
					'captcha_hcaptcha_site_key',
					'captcha_hcaptcha_secret_key',
					'captcha_turnstile_site_key',
					'captcha_turnstile_secret_key',
					// Legacy aliases
					'email_from_name',
					'email_from_address',
					'enable_spam_protection',
					'honeypot_enabled',
					'time_trap_enabled',
					'time_trap_min_seconds',
					// Privacy & GDPR
					'data_retention_days',
					'entries_trash_days',
					// Extensions, Webhooks
					'ext_webhooks_enabled',
					'ext_webhooks_signing_secret',
					'ext_webhooks_events',
					'ext_webhooks_retries',
					// Extensions, Email Marketing
					'ext_email_marketing_enabled',
					'ext_email_marketing_provider',
					'ext_email_marketing_api_key',
					'ext_email_marketing_list_id',
					'ext_email_marketing_double_optin',
					// Extensions, CRM
					'ext_crm_enabled',
					'ext_crm_provider',
					'ext_crm_api_key',
					'ext_crm_portal_id',
					'ext_crm_webhook_url',
					'ext_crm_add_note',
					// Extensions, Analytics
					'ext_analytics_enabled',
					'ext_analytics_view_tracking',
					'ext_analytics_retention_days',
					// Extensions, E-commerce
					'ext_ecommerce_enabled',
					'ext_ecommerce_product_id',
					'ext_ecommerce_currency',
					'ext_ecommerce_default_processor',
					'ext_ecommerce_empty_cart',
					'ext_ecommerce_destination',
					// Extensions, PDF
					'ext_pdf_enabled',
					'ext_pdf_template',
					'ext_pdf_attach_to_email',
					// Extensions, Multilanguage
					'ext_multilanguage_enabled',
					'ext_multilanguage_provider',
					// Extensions, Payments
					'ext_payments_enabled',
					'ext_payments_provider',
					'ext_payments_stripe_pk',
					'ext_payments_stripe_sk',
					'ext_payments_paypal_client_id',
					'ext_payments_paypal_client_secret',
					'ext_payments_currency',
					'ext_payments_mode',
					'ext_payments_failed_email',
				),

				// General
				'default_form_status'          => 'optional|in:draft,published',
				'autosave_enabled'             => 'optional|bool',
				'autosave_interval'            => 'optional|int|min:1|max:60',
				'delete_behavior'              => 'optional|in:soft,hard',
				'submissions_density'          => 'optional|in:comfortable,default,compact',
				'submissions_reading_pane'     => 'optional|in:right,below,off',
				// Frontend
				'success_message'              => 'optional|string|max:500',
				'error_message'                => 'optional|string|max:500',
				'redirect_after_submit'        => 'optional|string|max:500',
				'submission_limit_enabled'     => 'optional|bool',
				'submission_limit'             => 'optional|int|min:1',
				// Email / Notifications
				'admin_notification_enabled'   => 'optional|bool',
				'user_confirmation_enabled'    => 'optional|bool',
				'sender_name'                  => 'optional|string|max:255',
				'sender_email'                 => 'optional|string|max:255',
				'admin_email'                  => 'optional|string|max:255',
				// Advanced
				'debug_mode'                   => 'optional|bool',
				// Spam Protection
				'enable_honeypot'              => 'optional|bool',
				'min_submission_time'          => 'optional|int|min:0|max:300',
				// CAPTCHA
				'captcha_enabled'              => 'optional|bool',
				'captcha_provider'             => 'optional|string|max:50',
				'captcha_type'                 => 'optional|in:recaptcha,hcaptcha,turnstile',
				'captcha_recaptcha_enabled'    => 'optional|bool',
				'captcha_hcaptcha_enabled'     => 'optional|bool',
				'captcha_turnstile_enabled'    => 'optional|bool',
				'captcha_recaptcha_version'    => 'optional|in:v2,v3',
				'captcha_site_key'             => 'optional|string|max:255',
				'captcha_secret_key'           => 'optional|string|max:255',
				'captcha_recaptcha_site_key'   => 'optional|string|max:255',
				'captcha_recaptcha_secret_key' => 'optional|string|max:255',
				'captcha_hcaptcha_site_key'    => 'optional|string|max:255',
				'captcha_hcaptcha_secret_key'  => 'optional|string|max:255',
				'captcha_turnstile_site_key'   => 'optional|string|max:255',
				'captcha_turnstile_secret_key' => 'optional|string|max:255',
				// Legacy aliases
				'email_from_name'              => 'optional|string|max:255',
				'email_from_address'           => 'optional|string|max:255',
				'enable_spam_protection'       => 'optional|bool',
				'honeypot_enabled'             => 'optional|bool',
				'time_trap_enabled'            => 'optional|bool',
				'time_trap_min_seconds'        => 'optional|int|min:1|max:60',
				// Privacy & GDPR
				'data_retention_days'          => 'optional|int|min:0|max:3650',
				'entries_trash_days'           => 'optional|int|min:1|max:365',
				// Extensions, Webhooks
				'ext_webhooks_enabled'             => 'optional|bool',
				'ext_webhooks_signing_secret'      => 'optional|string|max:200',
				'ext_webhooks_events'              => 'optional|array',
				'ext_webhooks_retries'             => 'optional|int|min:0|max:5',
				// Extensions, Email Marketing
				'ext_email_marketing_enabled'      => 'optional|bool',
				'ext_email_marketing_provider'     => 'optional|in:mailchimp,brevo,convertkit',
				'ext_email_marketing_api_key'      => 'optional|string|max:500',
				'ext_email_marketing_list_id'      => 'optional|string|max:200',
				'ext_email_marketing_double_optin' => 'optional|bool',
				// Extensions, CRM
				'ext_crm_enabled'                  => 'optional|bool',
				'ext_crm_provider'                 => 'optional|in:hubspot,webhook',
				'ext_crm_api_key'                  => 'optional|string|max:500',
				'ext_crm_portal_id'                => 'optional|string|max:100',
				'ext_crm_webhook_url'              => 'optional|string|max:2000',
				'ext_crm_add_note'                 => 'optional|bool',
				// Extensions, Analytics
				'ext_analytics_enabled'            => 'optional|bool',
				'ext_analytics_view_tracking'      => 'optional|bool',
				'ext_analytics_retention_days'     => 'optional|int|min:1|max:3650',
				// Extensions, E-commerce
				'ext_ecommerce_enabled'            => 'optional|bool',
				'ext_ecommerce_product_id'         => 'optional|int|min:0',
				'ext_ecommerce_currency'           => 'optional|string|max:10',
				'ext_ecommerce_default_processor'  => 'optional|in:woocommerce,subtleforms',
				'ext_ecommerce_empty_cart'         => 'optional|bool',
				'ext_ecommerce_destination'        => 'optional|in:checkout,cart',
				// Extensions, PDF
				'ext_pdf_enabled'                  => 'optional|bool',
				'ext_pdf_template'                 => 'optional|string|max:100',
				'ext_pdf_attach_to_email'          => 'optional|bool',
				// Extensions, Multilanguage
				'ext_multilanguage_enabled'        => 'optional|bool',
				'ext_multilanguage_provider'       => 'optional|in:wpml,polylang',
				// Extensions, Payments
				'ext_payments_enabled'             => 'optional|bool',
				'ext_payments_provider'            => 'optional|in:stripe,paypal',
				'ext_payments_stripe_pk'           => 'optional|string|max:500',
				'ext_payments_stripe_sk'           => 'optional|string|max:500',
				'ext_payments_paypal_client_id'    => 'optional|string|max:500',
				'ext_payments_paypal_client_secret' => 'optional|string|max:500',
				'ext_payments_currency'            => 'optional|string|max:10',
				'ext_payments_mode'                => 'optional|in:test,live',
				'ext_payments_failed_email'        => 'optional|bool',
			),

			// Nested schemas

			// FormConfig
			'FormConfig' => array(
				'successMessage'   => 'optional|string|max:500',
				'redirectUrl'      => 'optional|url',
				'submitButtonText' => 'optional|string|max:100',
				'disableAfterSubmit' => 'optional|bool',
				'showProgressBar'  => 'optional|bool',
			),

			// FormSchema
			'FormSchema' => array(
				'fields'         => 'optional|array|list:FieldDefinition',
				'actions'        => 'optional|array|list:ActionConfig',
				'metadata'       => 'optional|object|map:FormMetadata',
				'schema_version' => 'optional|int|min:1',
			),

			// FieldDefinition
			// Accepts both legacy (name) and builder tree node (key/id/kind) formats.
			// Also accepts step/section container nodes which carry title, description,
			// and a nested fields array (handled recursively).
			// Advanced validation (min, max, pattern, minLength, maxLength) not supported yet (intentionally disabled).
			'FieldDefinition' => array(
				'__passthrough' => true,
				'type'         => 'optional|string|max:100',
				'name'         => 'optional|string|max:100',
				'key'          => 'optional|string|max:100',
				'id'           => 'optional|string|max:100',
				'kind'         => 'optional|string|max:50',
				// Consent and checkbox copy is often a short paragraph, not a title.
				'label'        => 'optional|string|max:2000',
				'title'        => 'optional|string|max:255',
				'description'  => 'optional|string|max:500',
				'placeholder'  => 'optional|string|max:255',
				'required'     => 'optional|bool|default:false',
				'options'      => 'optional|array',
				'defaultValue' => 'optional|string|max:500',
				'attributes'   => 'optional|object',
				'config'       => 'optional|object',
				'children'     => 'optional|array',
				'columns'      => 'optional|array',
				// Nested fields for step/section containers (multi-step forms)
				'fields'       => 'optional|array|list:FieldDefinition',
			),

			// ActionConfig
			//
			// `type` is shape-checked, not membership-checked. Which action types
			// exist is a runtime question owned by ActionRegistry, which extensions
			// add to through the `subtleforms/register_actions` hook, a literal list
			// here cannot know about those and would reject them on save. The
			// compiler is the layer that resolves a type, and it already soft-skips
			// one it cannot resolve so that a deactivated extension or a migration
			// gap does not break live submissions. Rejecting here instead turns the
			// same situation into a form that loads but can never be saved again.
			'ActionConfig' => array(
				'type'     => 'required|string|max:50',
				'id'       => 'optional|string|max:100',
				'settings' => 'optional|object',
				'config'   => 'optional|object|map:ActionSpecificConfig',
				'enabled'  => 'optional|bool|default:true',
				'order'    => 'optional|int|min:0|default:0',
			),

			// EmailSettings, full settings object for email actions
			'EmailSettings' => array(
				'to'      => 'required|string|max:500',
				'subject' => 'required|string|max:500',
				'message' => 'optional|string|max:50000',
				'headers' => 'optional|object',
			),

			// WebhookSettings, full settings object for webhook actions
			'WebhookSettings' => array(
				'url'            => 'optional|string|max:2000',
				'method'         => 'optional|in:POST,PUT,PATCH',
				'headers'        => 'optional|object',
				'payload_mode'   => 'optional|in:full,custom',
				'custom_payload' => 'optional|string|max:50000',
				'signing'        => 'optional|object',
			),

			// ActionSpecificConfig (flexible for different action types)
			'ActionSpecificConfig' => array(
				'to'          => 'optional|string|max:500|required_if:__parent.type,email',
				'from'        => 'optional|email',
				'subject'     => 'optional|string|max:500|required_if:__parent.type,email',
				'message'     => 'optional|string|max:5000',
				'replyTo'     => 'optional|email',
				// Webhook fields (Phase A2-P3: required_if for conditional validation)
				'url'         => 'optional|url|required_if:__parent.type,webhook',
				'method'      => 'optional|in:GET,POST,PUT,PATCH|default:POST',
				'headers'     => 'optional|object',
				'body'        => 'optional|string|max:5000',
				// Save fields
				'storageType' => 'optional|in:database,file',
			),

			// FormMetadata
			'FormMetadata' => array(
				'__passthrough' => true,
				// `multistep` is accepted alongside `multi-step` because templates and older
				// stored schemas use the short spelling. saveSchemaVersion canonicalises it,
				// so storage stays consistent while neither spelling is rejected outright.
				'type'         => 'optional|in:regular,contact,newsletter,survey,order,payment,registration,multi-step,multistep,sectioned,conversational',
				'name'         => 'optional|string|max:100',
				'title'        => 'optional|string|max:255',
				'description'  => 'optional|string|max:500',
				'template'     => 'optional|string|max:100',
				'version'      => 'optional|int|min:1',
				'tags'         => 'optional|array',
				'uses_pro'     => 'optional|bool',
				'pro_features' => 'optional|array',
				'payment'      => 'optional|object|map:PaymentConfig',
				// Undeclared keys are dropped from the validated output, so anything
				// the builder writes to metadata has to be listed here or it never
				// reaches the database. canvasWidth and integrations were written by
				// the settings tab but never declared, and so never persisted.
				'canvasWidth'  => 'optional|in:narrow,standard,wide',
				'integrations' => 'optional|object',
				'appearance'   => 'optional|object|map:FormAppearance',
				// 2.0: per-form confirmation, submit button and availability rules.
				'confirmation' => 'optional|object|map:FormConfirmation',
				// 2.1: conditional confirmations, first match wins (Pro).
				'confirmations' => 'optional|array|list:FormConditionalConfirmation',
				'submitText'   => 'optional|string|max:100',
				'restrictions' => 'optional|object|map:FormRestrictions',
				// 2.3: templates such as Newsletter hide the form title.
				'_showTitle'       => 'optional|bool',
				'_showDescription' => 'optional|bool',
				// 2.3.2: defaults for fields that do not set their own.
				'labelVisibility'      => 'optional|in:visible,hidden',
				'descriptionPlacement' => 'optional|in:below,above',
				'requiredMessage'      => 'optional|string|max:500',
				'validationMessage'    => 'optional|string|max:500',
			),

			// FormConfirmation, what visitors see after submitting (2.0).
			'FormConfirmation' => array(
				'type'         => 'optional|in:message,redirect|default:message',
				'title'        => 'optional|string|max:200',
				'message'      => 'optional|string|max:5000',
				'redirectUrl'  => 'optional|string|max:2000',
				'allowAnother' => 'optional|bool',
			),

			// A confirmation shown only when its rules match (2.1). `logic` is
			// kept as sent; SubtleForms Pro tidies it on save and the engine
			// ignores anything it does not understand.
			'FormConditionalConfirmation' => array(
				'id'           => 'optional|string|max:40',
				'label'        => 'optional|string|max:200',
				'enabled'      => 'optional|bool',
				'type'         => 'optional|in:message,redirect|default:message',
				'title'        => 'optional|string|max:200',
				'message'      => 'optional|string|max:5000',
				'redirectUrl'  => 'optional|string|max:2000',
				'allowAnother' => 'optional|bool',
				'logic'        => 'optional|object',
			),

			// FormRestrictions, who can submit, and when (2.0).
			'FormRestrictions' => array(
				'requireLogin'   => 'optional|bool',
				'loginMessage'   => 'optional|string|max:500',
				'openAt'         => 'optional|string|max:20',
				'notOpenMessage' => 'optional|string|max:500',
				'closeAt'        => 'optional|string|max:20',
				'closedMessage'  => 'optional|string|max:500',
				'entryLimit'     => 'optional|int|min:0',
				'limitMessage'   => 'optional|string|max:500',
			),

			// FormAppearance, form-wide styling.
			// Token and variant values are shape-checked here and value-checked by
			// Support\Appearance, which is where the allowed keys live.
			'FormAppearance' => array(
				'preset'   => 'optional|string|max:40',
				'tokens'   => 'optional|object',
				'variants' => 'optional|object',
			),

			// PaymentConfig (Phase A2-P3: at_least_one for flexible pricing)
			// Open (2.3.1): add-ons store more here (the checkout `processor`,
			// `billing` mapping), and forms priced by Product or Priced option
			// fields have no fixed amount or amount field. Requiring one made
			// every autosave of such a form fail (QA-03, form 11).
			'PaymentConfig' => array(
				'__passthrough' => true,
				'enabled'     => 'optional|bool|default:false',
				// Must list every currency the Payments panel offers. It offered JPY
				// and INR while this enum did not, so choosing either made the form
				// unsaveable from that point on.
				'currency'    => 'optional|in:USD,EUR,GBP,CAD,AUD,JPY,INR|default:USD',
				'amountType'  => 'optional|in:fixed,field,calculated|default:fixed',
				'fixedAmount' => 'optional|number|min:0',
				'amountField' => 'optional|string|max:100',
				'mode'        => 'optional|in:test,live|default:test',
			),
		);
	}

	/**
	 * Get single schema by name
	 *
	 * @param string $name Schema name
	 * @return array|null
	 */
	public static function get( string $name ): ?array {
		$all = self::all();
		return $all[ $name ] ?? null;
	}

	/**
	 * Validate route parameter (ID)
	 *
	 * @param mixed $id ID to validate
	 * @return int Validated ID
	 * @throws ValidationException If invalid
	 */
	public static function validateId( $id ): int {
		if ( ! is_numeric( $id ) || $id < 1 ) {
			throw ValidationException::forField( 'id', 'Invalid ID: must be positive integer' );
		}
		return (int) $id;
	}

	/**
	 * Validate pagination parameters
	 *
	 * @param array $params Query parameters
	 * @return array{page: int, per_page: int} Validated pagination
	 * @throws ValidationException If invalid
	 */
	public static function validatePagination( array $params ): array {
		$errors = array();

		$page    = $params['page'] ?? 1;
		$perPage = $params['per_page'] ?? 20;

		if ( ! is_numeric( $page ) || $page < 1 ) {
			$errors['page'] = 'Page must be positive integer';
		}

		if ( ! is_numeric( $perPage ) || $perPage < 1 || $perPage > 100 ) {
			$errors['per_page'] = 'Per page must be between 1 and 100';
		}

		if ( ! empty( $errors ) ) {
			throw ValidationException::withFields( $errors, 'Invalid pagination parameters' ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		return array(
			'page'     => (int) $page,
			'per_page' => (int) $perPage,
		);
	}

	/**
	 * Validate query parameters
	 *
	 * @param array $params Query parameters
	 * @param array $schema Validation schema
	 * @return array Validated parameters
	 * @throws ValidationException If invalid
	 */
	public static function validateQuery( array $params, array $schema ): array {
		$validator = new RequestValidator();
		return $validator->validateOrFail( $params, $schema );
	}
}
