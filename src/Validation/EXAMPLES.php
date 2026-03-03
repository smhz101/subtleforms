<?php
/**
 * Phase A2-P1: Validation Infrastructure Usage Examples
 *
 * Quick reference for using the validation layer in REST endpoints.
 * DO NOT INCLUDE THIS FILE IN PRODUCTION - EXAMPLES ONLY
 *
 * @package SubtleForms\Validation
 * @since 1.9.0 (Phase A2-P1)
 */

namespace SubtleForms\Examples;

use SubtleForms\Validation\ValidationException;
use SubtleForms\Validation\Sanitizer;
use SubtleForms\Validation\Rules;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Api\ApiResponse;

/**
 * EXAMPLE 1: Basic Field Validation
 */
function example_basic_validation() {
	$schema = array(
		'title'  => 'required|string|min:1|max:255',
		'email'  => 'required|email',
		'age'    => 'optional|int|min:18|default:18',
		'status' => 'optional|in:draft,published|default:draft',
	);

	$input = array(
		'title' => 'Contact Form',
		'email' => 'admin@example.com',
	);

	try {
		$validator = new RequestValidator();
		$validated = $validator->validateOrFail( $input, $schema );

		// $validated = [
		//   'title' => 'Contact Form',
		//   'email' => 'admin@example.com',
		//   'age' => 18,           // Default applied
		//   'status' => 'draft'    // Default applied
		// ]

		return ApiResponse::success( $validated );

	} catch ( ValidationException $e ) {
		// Returns 422 with field-level errors
		return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
	}
}

/**
 * EXAMPLE 2: Nested Schema Validation
 */
function example_nested_validation() {
	$formCreateSchema = array(
		'title'  => 'required|string|max:255',
		'config' => 'optional|object|map:FormConfig',
	);

	$namedSchemas = array(
		'FormConfig' => array(
			'successMessage'   => 'optional|string|max:500',
			'redirectUrl'      => 'optional|url',
			'submitButtonText' => 'optional|string|max:100|default:Submit',
		),
	);

	$input = array(
		'title'  => 'Newsletter Signup',
		'config' => array(
			'successMessage' => 'Thank you for subscribing!',
			'redirectUrl'    => 'https://example.com/thanks',
		),
	);

	$validator = new RequestValidator( array( 'schemas' => $namedSchemas ) );
	$validated = $validator->validateOrFail( $input, $formCreateSchema );

	// $validated['config'] is fully validated with nested schema
}

/**
 * EXAMPLE 3: Array of Items (list:) Validation
 */
function example_list_validation() {
	$schemaUpdatePayload = array(
		'fields' => 'required|array|list:FieldDefinition',
	);

	$namedSchemas = array(
		'FieldDefinition' => array(
			'type'     => 'required|in:text,email,textarea,select',
			'name'     => 'required|string|min:1|max:100',
			'label'    => 'required|string|max:255',
			'required' => 'optional|bool|default:false',
		),
	);

	$input = array(
		'fields' => array(
			array(
				'type'     => 'text',
				'name'     => 'full_name',
				'label'    => 'Full Name',
				'required' => true,
			),
			array(
				'type'  => 'email',
				'name'  => 'email',
				'label' => 'Email Address',
			),
		),
	);

	$validator = new RequestValidator( array( 'schemas' => $namedSchemas ) );
	$validated = $validator->validateOrFail( $input, $schemaUpdatePayload );

	// Each item in $validated['fields'] is validated and sanitized
}

/**
 * EXAMPLE 4: Allow-Listing Unknown Keys
 */
function example_allow_listing() {
	// Method 1: __allow meta key
	$schema1 = array(
		'__allow' => array( 'title', 'status', 'config' ), // Only these keys allowed
		'title'   => 'required|string',
		'status'  => 'optional|in:draft,published',
		'config'  => 'optional|object',
	);

	// Method 2: allow_keys rule on specific field
	$schema2 = array(
		'settings' => 'required|object|allow_keys:email,webhook,redirect',
	);

	$input = array(
		'title'        => 'Form',
		'status'       => 'draft',
		'unknown_key'  => 'bad', // Will cause validation error
	);

	try {
		$validator = new RequestValidator();
		$validator->validateOrFail( $input, $schema1 );
	} catch ( ValidationException $e ) {
		// $e->getFields() contains: ['unknown_key' => 'Unknown field']
	}
}

/**
 * EXAMPLE 5: Sanitization Functions
 */
function example_sanitization() {
	// Basic sanitization
	$clean = Sanitizer::sanitizeText( '<script>alert(1)</script>Hello' );
	// Result: 'Hello' (tags stripped)

	$email = Sanitizer::sanitizeEmail( ' USER@EXAMPLE.COM ' );
	// Result: 'user@example.com'

	$url = Sanitizer::sanitizeUrl( 'javascript:alert(1)' );
	// Result: '' (invalid URL removed)

	// Deep array sanitization
	$dirtyArray = array(
		'name'   => '<b>John</b>',
		'nested' => array(
			'data' => '<script>evil</script>',
		),
	);
	$clean = Sanitizer::sanitizeArrayDeep( $dirtyArray );
	// Result: ['name' => 'John', 'nested' => ['data' => 'evil']]

	// JSON sanitization
	try {
		$decoded = Sanitizer::sanitizeJsonString( '{"key":"<script>bad</script>"}' );
		// Result: ['key' => 'bad'] (decoded and sanitized)
	} catch ( ValidationException $e ) {
		// Thrown if JSON is invalid or too large
	}
}

/**
 * EXAMPLE 6: Custom Error Messages
 */
function example_custom_errors() {
	// Create exception with custom fields
	throw ValidationException::withFields(
		array(
			'email' => 'Email address is already registered',
			'phone' => 'Phone number must include country code',
		),
		'Registration failed'
	);

	// Single field error
	throw ValidationException::forField(
		'username',
		'Username is already taken',
		'Registration failed'
	);
}

/**
 * EXAMPLE 7: REST Endpoint Integration
 */
function example_endpoint_integration() {
	// In RestController.php or similar

	/**
	 * Create form endpoint with validation
	 */
	/*
	public function create_form( WP_REST_Request $request ) {
		$schema = array(
			'__allow' => array('title', 'config'),
			'title' => 'required|string|min:1|max:255',
			'config' => 'optional|object|map:FormConfig',
		);

		$namedSchemas = array(
			'FormConfig' => array(
				'successMessage' => 'optional|string|max:500',
				'redirectUrl' => 'optional|url',
			),
		);

		try {
			$validator = new RequestValidator(array('schemas' => $namedSchemas));
			$validated = $validator->validateOrFail(
				$request->get_json_params(),
				$schema
			);

			// Use sanitized data
			$formId = $this->formsRepo->create($validated);

			return ApiResponse::success(array('id' => $formId), 201);

		} catch (ValidationException $e) {
			return ApiResponse::validation_error($e->getMessage(), $e->getFields());
		}
	}
	*/
}

/**
 * EXAMPLE 8: Conditional Rules (for future Phase A2-P3)
 */
function example_conditional_rules_future() {
	// These rules are planned for Phase A2-P3:
	/*
	$schema = array(
		'type' => 'required|in:email,webhook',
		'to' => 'required_if:type,email|email',
		'url' => 'required_if:type,webhook|url',
		'subject' => 'required_unless:type,webhook|string',
	);
	*/
}
