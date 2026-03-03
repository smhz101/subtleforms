<?php
/**
 * RequestValidator
 *
 * Schema-based validation orchestrator for REST API requests.
 * Validates input against declarative schemas with nested support.
 *
 * @package SubtleForms\Validation
 * @since 1.9.0 (Phase A2-P1)
 */

namespace SubtleForms\Validation;

/**
 * RequestValidator class
 *
 * Provides schema-based validation with:
 * - Field-level error reporting
 * - Nested schema support (map:, list:)
 * - Key allow-listing
 * - Sanitization during validation
 * - Depth limits for recursion protection
 */
class RequestValidator {

	/**
	 * Maximum recursion depth for nested validation
	 *
	 * @var int
	 */
	const MAX_DEPTH = 8;

	/**
	 * Maximum payload size in bytes
	 *
	 * @var int
	 */
	const MAX_PAYLOAD_BYTES = 200000; // 200KB

	/**
	 * Named schemas registry
	 *
	 * @var array<string,array>
	 */
	private $schemas = array();

	/**
	 * Validation options
	 *
	 * @var array
	 */
	private $options = array();

	/**
	 * Constructor
	 *
	 * @param array $options Validation options
	 */
	public function __construct( array $options = array() ) {
		$this->options = $options;
		$this->schemas = $options['schemas'] ?? array();
	}

	/**
	 * Validate input against schema
	 *
	 * Returns sanitized output if valid.
	 *
	 * @param array $input Input data to validate
	 * @param array $schema Validation schema
	 * @param array $options Additional options
	 * @return array Sanitized and validated data
	 * @throws ValidationException If validation fails
	 */
	public function validateOrFail( array $input, array $schema, array $options = array() ): array {
		// Merge schemas
		if ( isset( $options['schemas'] ) ) {
			$this->schemas = array_merge( $this->schemas, $options['schemas'] );
		}

		// Check payload size
		$maxBytes = $options['maxBytes'] ?? self::MAX_PAYLOAD_BYTES;
		$inputSize = strlen( json_encode( $input ) );
		if ( $inputSize > $maxBytes ) {
			throw new ValidationException(
				'Payload too large',
				array( '__root' => sprintf( 'Maximum payload size is %d bytes', $maxBytes ) ),
				'payload_too_large'
			);
		}

		// Validate
		list( $valid, $sanitized, $errors ) = $this->validateSchema( $input, $schema, '', 0 );

		if ( ! $valid ) {
			throw ValidationException::withFields( $errors, 'Validation failed' );
		}

		return $sanitized;
	}

	/**
	 * Validate input against schema (non-throwing)
	 *
	 * @param array $input Input data
	 * @param array $schema Validation schema
	 * @param array $options Options
	 * @return array{valid: bool, data: array, errors: array}
	 */
	public function validate( array $input, array $schema, array $options = array() ): array {
		try {
			$sanitized = $this->validateOrFail( $input, $schema, $options );
			return array(
				'valid'  => true,
				'data'   => $sanitized,
				'errors' => array(),
			);
		} catch ( ValidationException $e ) {
			return array(
				'valid'  => false,
				'data'   => array(),
				'errors' => $e->getFields(),
			);
		}
	}

	/**
	 * Validate data against schema (internal)
	 *
	 * @param array  $input Input data
	 * @param array  $schema Schema definition
	 * @param string $basePath Base path for nested errors
	 * @param int    $depth Current recursion depth
	 * @return array{0: bool, 1: array, 2: array}
	 */
	private function validateSchema( array $input, array $schema, string $basePath, int $depth ): array {
		// Check depth limit
		if ( $depth >= self::MAX_DEPTH ) {
			return array(
				false,
				array(),
				array( $basePath ?: '__root' => 'Maximum nesting depth exceeded' ),
			);
		}

		$errors    = array();
		$sanitized = array();

		// Check for allow-listing
		$allowedKeys = $schema['__allow'] ?? null;
		if ( is_array( $allowedKeys ) ) {
			$unknownKeys = array_diff( array_keys( $input ), $allowedKeys );
			if ( ! empty( $unknownKeys ) ) {
				foreach ( $unknownKeys as $key ) {
					$path           = $basePath ? "{$basePath}.{$key}" : $key;
					$errors[ $path ] = 'Unknown field';
				}
				// Continue validation for known keys
			}
		}

		// Validate each field in schema
		foreach ( $schema as $field => $rules ) {
			// Skip meta keys
			if ( strpos( $field, '__' ) === 0 ) {
				continue;
			}

			$path  = $basePath ? "{$basePath}.{$field}" : $field;
			$value = $input[ $field ] ?? null;

			// Parse rules
			$parsedRules = Rules::parse( $rules );

			// Check if field has nested schema (map: or list:)
			$hasMap  = $this->hasRule( $parsedRules, 'map' );
			$hasList = $this->hasRule( $parsedRules, 'list' );

		// If field is optional and empty, skip nested validation
		$isRequired = in_array( 'required', $parsedRules, true );
		$valueIsEmpty = is_null( $value ) || ( is_string( $value ) && trim( $value ) === '' ) || ( is_array( $value ) && empty( $value ) );
		if ( ! $isRequired && $valueIsEmpty ) {
			// Do not include optional empty fields in sanitized output
			continue;
		}

		if ( $hasMap ) {
			$schemaName = $this->getRuleParam( $parsedRules, 'map' );
			if ( $schemaName && isset( $this->schemas[ $schemaName ] ) ) {
				if ( ! is_array( $value ) ) {
					$errors[ $path ] = 'Must be an object';
					continue;
				}
				list( $nestedValid, $nestedSanitized, $nestedErrors ) = $this->validateSchema(
					$value,
					$this->schemas[ $schemaName ],
					$path,
					$depth + 1
				);
				if ( ! $nestedValid ) {
					$errors = array_merge( $errors, $nestedErrors );
					continue;
				}
				$sanitized[ $field ] = $nestedSanitized;
				continue;
			}
		}

			if ( $hasList ) {
				// Array of items validation
				$schemaName = $this->getRuleParam( $parsedRules, 'list' );
				if ( $schemaName && isset( $this->schemas[ $schemaName ] ) ) {
					if ( ! is_array( $value ) ) {
						$errors[ $path ] = 'Must be an array';
						continue;
					}
					$sanitizedList = array();
					foreach ( $value as $index => $item ) {
						if ( ! is_array( $item ) ) {
							$errors[ "{$path}[{$index}]" ] = 'Must be an object';
							continue;
						}
						list( $itemValid, $itemSanitized, $itemErrors ) = $this->validateSchema(
							$item,
							$this->schemas[ $schemaName ],
							"{$path}[{$index}]",
							$depth + 1
						);
						if ( ! $itemValid ) {
							$errors = array_merge( $errors, $itemErrors );
							continue;
						}
						$sanitizedList[] = $itemSanitized;
					}
					$sanitized[ $field ] = $sanitizedList;
					continue;
				}
			}

			// Standard field validation
			list( $valid, $fieldSanitized, $error ) = Rules::validateField(
				$value,
				$parsedRules,
				$path,
				array( $this, 'resolveSchema' ),
				$input // Pass full input context for conditional rules (Phase A2-P3)
			);

			if ( ! $valid ) {
				$errors[ $path ] = $error;
			} else {
				$sanitized[ $field ] = $fieldSanitized;
			}
		}

		// Phase A2-P3: Validate cross-field rules (one_of, at_least_one)
		$crossFieldErrors = $this->validateCrossFieldRules( $schema, $input, $basePath );
		if ( ! empty( $crossFieldErrors ) ) {
			$errors = array_merge( $errors, $crossFieldErrors );
		}

		$isValid = empty( $errors );
		return array( $isValid, $sanitized, $errors );
	}

	/**
	 * Resolve named schema
	 *
	 * @param string $name Schema name
	 * @return array|null
	 */
	public function resolveSchema( string $name ): ?array {
		return $this->schemas[ $name ] ?? null;
	}

	/**
	 * Check if rules contain specific rule
	 *
	 * @param array  $rules Parsed rules
	 * @param string $ruleName Rule name to check
	 * @return bool
	 */
	private function hasRule( array $rules, string $ruleName ): bool {
		foreach ( $rules as $rule ) {
			if ( strpos( $rule, $ruleName . ':' ) === 0 ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get parameter for specific rule
	 *
	 * @param array  $rules Parsed rules
	 * @param string $ruleName Rule name
	 * @return string|null
	 */
	private function getRuleParam( array $rules, string $ruleName ): ?string {
		foreach ( $rules as $rule ) {
			if ( strpos( $rule, $ruleName . ':' ) === 0 ) {
				return substr( $rule, strlen( $ruleName ) + 1 );
			}
		}
		return null;
	}

	/**
	 * Validate cross-field rules (one_of, at_least_one)
	 *
	 * These rules require analyzing multiple fields together.
	 *
	 * @param array  $schema Validation schema
	 * @param array  $input Input data
	 * @param string $basePath Base field path
	 * @return array Errors array
	 */
	private function validateCrossFieldRules( array $schema, array $input, string $basePath ): array {
		$errors = array();

		// Check for one_of and at_least_one rules
		foreach ( $schema as $field => $rules ) {
			if ( strpos( $field, '__' ) === 0 ) {
				continue;
			}

			$parsedRules = Rules::parse( $rules );
			foreach ( $parsedRules as $rule ) {
				if ( strpos( $rule, 'one_of:' ) === 0 ) {
					$param = substr( $rule, 7 );
					$fields = array_map( 'trim', explode( ',', $param ) );
					
					// Count how many of the specified fields are present
					$presentCount = 0;
					foreach ( $fields as $fieldName ) {
						$value = $input[ $fieldName ] ?? null;
						// Use Rules::isEmpty for consistency
						if ( ! $this->isFieldEmpty( $value ) ) {
							$presentCount++;
						}
					}

					if ( $presentCount !== 1 ) {
						$path = $basePath ? $basePath : '__cross_field';
						$humanFields = array_map( array( $this, 'humanizeFieldName' ), $fields );
						if ( $presentCount === 0 ) {
							$errors[ $path ] = sprintf( 'Exactly one of the following fields is required: %s', implode( ', ', $humanFields ) );
						} else {
							$errors[ $path ] = sprintf( 'Only one of the following fields can be provided: %s', implode( ', ', $humanFields ) );
						}
					}
				}

				if ( strpos( $rule, 'at_least_one:' ) === 0 ) {
					$param = substr( $rule, 13 );
					$fields = array_map( 'trim', explode( ',', $param ) );
					
					// Count how many of the specified fields are present
					$presentCount = 0;
					foreach ( $fields as $fieldName ) {
						$value = $input[ $fieldName ] ?? null;
						if ( ! $this->isFieldEmpty( $value ) ) {
							$presentCount++;
						}
					}

					if ( $presentCount === 0 ) {
						$path = $basePath ? $basePath : '__cross_field';
						$humanFields = array_map( array( $this, 'humanizeFieldName' ), $fields );
						$errors[ $path ] = sprintf( 'At least one of the following fields is required: %s', implode( ', ', $humanFields ) );
					}
				}
			}
		}

		return $errors;
	}

	/**
	 * Check if field value is empty
	 *
	 * @param mixed $value Value to check
	 * @return bool
	 */
	private function isFieldEmpty( $value ): bool {
		if ( is_null( $value ) ) {
			return true;
		}
		if ( is_string( $value ) && trim( $value ) === '' ) {
			return true;
		}
		if ( is_array( $value ) && empty( $value ) ) {
			return true;
		}
		return false;
	}

	/**
	 * Convert field name to human-readable format
	 *
	 * @param string $field Field name
	 * @return string Human-readable name
	 */
	private function humanizeFieldName( string $field ): string {
		// Convert snake_case and camelCase to spaces
		$name = preg_replace( '/([a-z])([A-Z])/', '$1 $2', $field );
		$name = str_replace( '_', ' ', $name );
		return ucwords( $name );
	}
}
