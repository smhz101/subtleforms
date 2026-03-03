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
				'__allow' => array( 'status', 'notes' ),
				'status'  => 'optional|in:read,unread,archived,spam',
				'notes'   => 'optional|string|max:500',
			),

			// Public Submit Payload
			self::PUBLIC_SUBMIT => array(
				'__allow'       => array( 'data', 'meta', 'website_url', 'form_rendered_at' ),
				'data'          => 'required|object',
				'meta'          => 'optional|object',
				'website_url'   => 'optional|string', // Honeypot
				'form_rendered_at' => 'optional|string', // Time trap
			),

			// Settings Update
			self::SETTINGS_UPDATE => array(
				'__allow'                      => array(
					'admin_email',
					'submission_limit_enabled',
					'submission_limit',
					'captcha_enabled',
					'captcha_type',
					'captcha_recaptcha_enabled',
					'captcha_hcaptcha_enabled',
					'captcha_turnstile_enabled',
					'captcha_site_key',
					'captcha_secret_key',
					'captcha_recaptcha_site_key',
					'captcha_recaptcha_secret_key',
					'captcha_hcaptcha_site_key',
					'captcha_hcaptcha_secret_key',
					'captcha_turnstile_site_key',
					'captcha_turnstile_secret_key',
					'email_from_name',
					'email_from_address',
					'enable_spam_protection',
					'honeypot_enabled',
					'time_trap_enabled',
					'time_trap_min_seconds',
				),
				'admin_email'                  => 'optional|email',
				'submission_limit_enabled'     => 'optional|bool',
			'submission_limit'             => 'optional|int|min:1|required_if:submission_limit_enabled,true|default:1',
			'captcha_enabled'              => 'optional|bool',
			'captcha_type'                 => 'optional|in:recaptcha,hcaptcha,turnstile',
			'captcha_recaptcha_enabled'    => 'optional|bool',
			'captcha_hcaptcha_enabled'     => 'optional|bool',
			'captcha_turnstile_enabled'    => 'optional|bool',
			'captcha_site_key'             => 'optional|string|max:255|required_if:captcha_enabled,true',
			'captcha_secret_key'           => 'optional|string|max:255|required_if:captcha_enabled,true',
			'captcha_recaptcha_site_key'   => 'optional|string|max:255|required_if:captcha_recaptcha_enabled,true',
			'captcha_recaptcha_secret_key' => 'optional|string|max:255|required_if:captcha_recaptcha_enabled,true',
			'captcha_hcaptcha_site_key'    => 'optional|string|max:255|required_if:captcha_hcaptcha_enabled,true',
			'captcha_hcaptcha_secret_key'  => 'optional|string|max:255|required_if:captcha_hcaptcha_enabled,true',
			'captcha_turnstile_site_key'   => 'optional|string|max:255|required_if:captcha_turnstile_enabled,true',
			'captcha_turnstile_secret_key' => 'optional|string|max:255|required_if:captcha_turnstile_enabled,true',
				'email_from_name'              => 'optional|string|max:255',
				'email_from_address'           => 'optional|email',
				'enable_spam_protection'       => 'optional|bool',
				'honeypot_enabled'             => 'optional|bool',
				'time_trap_enabled'            => 'optional|bool',
				'time_trap_min_seconds'        => 'optional|int|min:1|max:60|default:3',
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
				'fields'   => 'optional|array|list:FieldDefinition',
				'actions'  => 'optional|array|list:ActionConfig',
				'metadata' => 'optional|object|map:FormMetadata',
			),

			// FieldDefinition
			// Accepts both legacy (name) and builder tree node (key/id/kind) formats.
			'FieldDefinition' => array(
				'type'         => 'optional|string|max:100',
				'name'         => 'optional|string|max:100',
				'key'          => 'optional|string|max:100',
				'id'           => 'optional|string|max:100',
				'kind'         => 'optional|string|max:50',
				'label'        => 'optional|string|max:255',
				'placeholder'  => 'optional|string|max:255',
				'required'     => 'optional|bool|default:false',
				'options'      => 'optional|array',
				'defaultValue' => 'optional|string|max:500',
				'validation'   => 'optional|object|map:FieldValidation',
				'attributes'   => 'optional|object',
				'config'       => 'optional|object',
				'children'     => 'optional|array',
				'columns'      => 'optional|array',
			),

			// FieldValidation
			'FieldValidation' => array(
				'pattern' => 'optional|string|max:500',
				'min'     => 'optional|int',
				'max'     => 'optional|int',
				'minLength' => 'optional|int',
				'maxLength' => 'optional|int',
			),

			// ActionConfig
			'ActionConfig' => array(
				'type'    => 'required|in:email,webhook,save',
				'config'  => 'required|object|map:ActionSpecificConfig',
				'enabled' => 'optional|bool|default:true',
				'order'   => 'optional|int|min:0|default:0',
			),

			// ActionSpecificConfig (flexible for different action types)
			'ActionSpecificConfig' => array(
				// Email fields (Phase A2-P3: required_if for conditional validation)
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
			'type'        => 'optional|in:regular,contact,newsletter,survey,order,payment,registration',
				'version'     => 'optional|int|min:1',
				'description' => 'optional|string|max:500',
				'tags'        => 'optional|array',
				'payment'     => 'optional|object|map:PaymentConfig',
			),

			// PaymentConfig (Phase A2-P3: at_least_one for flexible pricing)
			'PaymentConfig' => array(
				'enabled'     => 'optional|bool|default:false',
				'currency'    => 'optional|in:USD,EUR,GBP,CAD,AUD|default:USD',
				'amountType'  => 'optional|in:fixed,field,calculated|default:fixed',
				'fixedAmount' => 'optional|number|min:0|at_least_one:fixedAmount,amountField',
				'amountField' => 'optional|string|max:100|at_least_one:fixedAmount,amountField',
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
			throw ValidationException::withFields( $errors, 'Invalid pagination parameters' );
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
