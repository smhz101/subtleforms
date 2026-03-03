<?php
/**
 * Rules
 *
 * Validation rule parser and validator with composable rule set.
 * Supports declarative validation schemas without external dependencies.
 *
 * @package SubtleForms\Validation
 * @since 1.9.0 (Phase A2-P1)
 */

namespace SubtleForms\Validation;

/**
 * Rules class
 *
 * Parses and validates fields based on declarative rule strings.
 * Supports nested schemas via map: and list: references.
 */
class Rules {

	/**
	 * Parse rule string or array into normalized rule array
	 *
	 * Examples:
	 * - "required|string|max:255"
	 * - ["required", "email"]
	 * - "optional|int|min:1|default:0"
	 *
	 * @param array|string $rules Rules to parse
	 * @return array Parsed rules
	 */
	public static function parse( $rules ): array {
		if ( is_array( $rules ) ) {
			return $rules;
		}

		if ( ! is_string( $rules ) ) {
			return array();
		}

		return array_map( 'trim', explode( '|', $rules ) );
	}

	/**
	 * Validate field value against rules
	 *
	 * Returns [isValid, sanitizedValue, errorMessage|null]
	 *
	 * @param mixed    $value Value to validate
	 * @param array    $rules Parsed rules
	 * @param string   $path Field path for nested errors (e.g., "config.email")
	 * @param callable $schemaResolver Function to resolve named schemas: fn(string $name) => array|null
	 * @param array    $allInput Full input context for conditional rules (Phase A2-P3)
	 * @return array{0: bool, 1: mixed, 2: string|null}
	 */
	public static function validateField( $value, array $rules, string $path, callable $schemaResolver, array $allInput = array() ): array {
		$isRequired = in_array( 'required', $rules, true );
		$isNullable = in_array( 'nullable', $rules, true );

		// Check required
		if ( $isRequired && self::isEmpty( $value ) ) {
			return array( false, null, 'This field is required' );
		}

		// Allow null if nullable
		if ( $isNullable && is_null( $value ) ) {
			return array( true, null, null );
		}

		// Handle missing optional fields with default
		if ( ! $isRequired && self::isEmpty( $value ) ) {
			$default = self::extractDefault( $rules );
			return array( true, $default, null );
		}

		// Process rules
		$sanitized = $value;

		foreach ( $rules as $rule ) {
			// Skip meta rules
			if ( in_array( $rule, array( 'required', 'optional', 'nullable' ), true ) ) {
				continue;
			}

			// Parse rule with parameter (e.g., "max:255")
			list( $ruleName, $param ) = self::parseRuleParam( $rule );

			// Apply rule
			list( $valid, $sanitized, $error ) = self::applyRule( $ruleName, $sanitized, $param, $path, $schemaResolver, $allInput, $value );

			if ( ! $valid ) {
				return array( false, $sanitized, $error );
			}
		}

		return array( true, $sanitized, null );
	}

	/**
	 * Check if value is empty (for required validation)
	 *
	 * @param mixed $value Value to check
	 * @return bool
	 */
	private static function isEmpty( $value ): bool {
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
	 * Extract default value from rules
	 *
	 * @param array $rules Parsed rules
	 * @return mixed Default value or null
	 */
	private static function extractDefault( array $rules ) {
		foreach ( $rules as $rule ) {
			if ( strpos( $rule, 'default:' ) === 0 ) {
				$default = substr( $rule, 8 );
				// Parse common types
				if ( $default === 'null' ) {
					return null;
				}
				if ( $default === 'true' ) {
					return true;
				}
				if ( $default === 'false' ) {
					return false;
				}
				if ( is_numeric( $default ) ) {
					return strpos( $default, '.' ) !== false ? (float) $default : (int) $default;
				}
				return $default;
			}
		}
		return null;
	}

	/**
	 * Parse rule with parameter
	 *
	 * @param string $rule Rule string (e.g., "max:255")
	 * @return array{0: string, 1: string|null} [ruleName, parameter]
	 */
	private static function parseRuleParam( string $rule ): array {
		$parts = explode( ':', $rule, 2 );
		return array( $parts[0], $parts[1] ?? null );
	}

	/**
	 * Apply single validation rule
	 *
	 * @param string   $ruleName Rule name
	 * @param mixed    $value Value to validate (sanitized)
	 * @param string|null $param Rule parameter
	 * @param string   $path Field path
	 * @param callable $schemaResolver Schema resolver function
	 * @param array    $allInput Full input context for conditional rules
	 * @param mixed    $originalValue Original unsanitized value for conditional checks
	 * @return array{0: bool, 1: mixed, 2: string|null}
	 */
	private static function applyRule( string $ruleName, $value, $param, string $path, callable $schemaResolver, array $allInput = array(), $originalValue = null ): array {
		switch ( $ruleName ) {
			case 'string':
				if ( ! is_string( $value ) ) {
					return array( false, $value, 'Must be a string' );
				}
				return array( true, Sanitizer::sanitizeText( $value ), null );

			case 'int':
				if ( ! is_numeric( $value ) ) {
					return array( false, $value, 'Must be an integer' );
				}
				return array( true, Sanitizer::sanitizeInt( $value ), null );

			case 'bool':
				return array( true, Sanitizer::sanitizeBool( $value ), null );

			case 'float':
			case 'number':
				if ( ! is_numeric( $value ) ) {
					return array( false, $value, 'Must be a number' );
				}
				return array( true, Sanitizer::sanitizeFloat( $value ), null );

			case 'array':
				if ( ! is_array( $value ) ) {
					return array( false, $value, 'Must be an array' );
				}
				return array( true, $value, null );

			case 'object':
				if ( ! is_array( $value ) || array_keys( $value ) === range( 0, count( $value ) - 1 ) ) {
					return array( false, $value, 'Must be an object (associative array)' );
				}
				return array( true, $value, null );

			case 'email':
				$sanitized = Sanitizer::sanitizeEmail( $value );
				if ( ! filter_var( $sanitized, FILTER_VALIDATE_EMAIL ) ) {
					return array( false, $sanitized, 'Invalid email address' );
				}
				return array( true, $sanitized, null );

			case 'url':
				$sanitized = Sanitizer::sanitizeUrl( $value );
				if ( ! filter_var( $sanitized, FILTER_VALIDATE_URL ) ) {
					return array( false, $sanitized, 'Invalid URL' );
				}
				return array( true, $sanitized, null );

			case 'max':
				if ( is_null( $param ) ) {
					return array( false, $value, 'max rule requires parameter' );
				}
				$max = (int) $param;
				if ( is_string( $value ) && mb_strlen( $value ) > $max ) {
					return array( false, $value, sprintf( 'Maximum length is %d characters', $max ) );
				}
				if ( is_numeric( $value ) && $value > $max ) {
					return array( false, $value, sprintf( 'Maximum value is %d', $max ) );
				}
				return array( true, $value, null );

			case 'min':
				if ( is_null( $param ) ) {
					return array( false, $value, 'min rule requires parameter' );
				}
				$min = (int) $param;
				if ( is_string( $value ) && mb_strlen( $value ) < $min ) {
					return array( false, $value, sprintf( 'Minimum length is %d characters', $min ) );
				}
				if ( is_numeric( $value ) && $value < $min ) {
					return array( false, $value, sprintf( 'Minimum value is %d', $min ) );
				}
				return array( true, $value, null );

			case 'in':
				if ( is_null( $param ) ) {
					return array( false, $value, 'in rule requires parameter' );
				}
				$allowed = array_map( 'trim', explode( ',', $param ) );
				if ( ! in_array( $value, $allowed, true ) ) {
					return array( false, $value, sprintf( 'Must be one of: %s', implode( ', ', $allowed ) ) );
				}
				return array( true, $value, null );

			case 'regex':
				if ( is_null( $param ) ) {
					return array( false, $value, 'regex rule requires parameter' );
				}
				if ( ! is_string( $value ) ) {
					return array( false, $value, 'Must be a string for regex validation' );
				}
				if ( ! preg_match( $param, $value ) ) {
					return array( false, $value, 'Invalid format' );
				}
				return array( true, $value, null );

			case 'json':
				if ( ! is_string( $value ) ) {
					return array( false, $value, 'Must be a JSON string' );
				}
				try {
					$decoded = Sanitizer::sanitizeJsonString( $value );
					return array( true, $decoded, null );
				} catch ( ValidationException $e ) {
					return array( false, $value, $e->getMessage() );
				}

			case 'map':
				// Nested schema reference: map:SchemaName
				if ( is_null( $param ) ) {
					return array( false, $value, 'map rule requires schema name' );
				}
				if ( ! is_array( $value ) ) {
					return array( false, $value, 'Must be an object for map validation' );
				}
				$schema = $schemaResolver( $param );
				if ( is_null( $schema ) ) {
					return array( false, $value, sprintf( 'Unknown schema: %s', $param ) );
				}
				// Validate nested - will be handled by RequestValidator
				return array( true, $value, null );

			case 'list':
				// Array of items: list:SchemaName
				if ( is_null( $param ) ) {
					return array( false, $value, 'list rule requires schema name' );
				}
				if ( ! is_array( $value ) ) {
					return array( false, $value, 'Must be an array for list validation' );
				}
				$schema = $schemaResolver( $param );
				if ( is_null( $schema ) ) {
					return array( false, $value, sprintf( 'Unknown schema: %s', $param ) );
				}
				// Validate items - will be handled by RequestValidator
				return array( true, $value, null );

			case 'allow_keys':
				// Allow-listing for object keys
				if ( is_null( $param ) ) {
					return array( false, $value, 'allow_keys rule requires key list' );
				}
				if ( ! is_array( $value ) ) {
					return array( false, $value, 'Must be an object for allow_keys validation' );
				}
				$allowed = array_map( 'trim', explode( ',', $param ) );
				$unknown = array_diff( array_keys( $value ), $allowed );
				if ( ! empty( $unknown ) ) {
					return array( false, $value, sprintf( 'Unknown fields: %s', implode( ', ', $unknown ) ) );
				}
				return array( true, $value, null );

			// Conditional rules (Phase A2-P3)
			case 'required_if':
				// Field is required if another field equals specific value
				if ( is_null( $param ) ) {
					return array( false, $value, 'required_if rule requires field,value parameters' );
				}
				$parts = array_map( 'trim', explode( ',', $param, 2 ) );
				if ( count( $parts ) !== 2 ) {
					return array( false, $value, 'required_if rule requires field,value format' );
				}
				list( $otherField, $expectedValue ) = $parts;
				$otherValue = $allInput[ $otherField ] ?? null;
				// Check if condition is met
				if ( (string) $otherValue === $expectedValue ) {
					if ( self::isEmpty( $originalValue ) ) {
						// Extract human-readable field name from path
						$fieldName = self::humanizeFieldName( $path );
						$conditionName = self::humanizeFieldName( $otherField );
						return array( false, null, sprintf( '%s is required when %s is "%s"', $fieldName, $conditionName, $expectedValue ) );
					}
				}
				return array( true, $value, null );

			case 'required_unless':
				// Field is required unless another field equals specific value
				if ( is_null( $param ) ) {
					return array( false, $value, 'required_unless rule requires field,value parameters' );
				}
				$parts = array_map( 'trim', explode( ',', $param, 2 ) );
				if ( count( $parts ) !== 2 ) {
					return array( false, $value, 'required_unless rule requires field,value format' );
				}
				list( $otherField, $excludedValue ) = $parts;
				$otherValue = $allInput[ $otherField ] ?? null;
				// Check if condition is met (opposite of required_if)
				if ( (string) $otherValue !== $excludedValue ) {
					if ( self::isEmpty( $originalValue ) ) {
						$fieldName = self::humanizeFieldName( $path );
						$conditionName = self::humanizeFieldName( $otherField );
						return array( false, null, sprintf( '%s is required unless %s is "%s"', $fieldName, $conditionName, $excludedValue ) );
					}
				}
				return array( true, $value, null );

			case 'required_with':
				// Field is required if another field is present (not empty)
				if ( is_null( $param ) ) {
					return array( false, $value, 'required_with rule requires field name' );
				}
				$otherField = trim( $param );
				$otherValue = $allInput[ $otherField ] ?? null;
				if ( ! self::isEmpty( $otherValue ) ) {
					if ( self::isEmpty( $originalValue ) ) {
						$fieldName = self::humanizeFieldName( $path );
						$conditionName = self::humanizeFieldName( $otherField );
						return array( false, null, sprintf( '%s is required when %s is provided', $fieldName, $conditionName ) );
					}
				}
				return array( true, $value, null );

			case 'prohibited_if':
				// Field must NOT be present if another field equals specific value
				if ( is_null( $param ) ) {
					return array( false, $value, 'prohibited_if rule requires field,value parameters' );
				}
				$parts = array_map( 'trim', explode( ',', $param, 2 ) );
				if ( count( $parts ) !== 2 ) {
					return array( false, $value, 'prohibited_if rule requires field,value format' );
				}
				list( $otherField, $prohibitedWhen ) = $parts;
				$otherValue = $allInput[ $otherField ] ?? null;
				if ( (string) $otherValue === $prohibitedWhen ) {
					if ( ! self::isEmpty( $originalValue ) ) {
						$fieldName = self::humanizeFieldName( $path );
						$conditionName = self::humanizeFieldName( $otherField );
						return array( false, $value, sprintf( '%s must not be provided when %s is "%s"', $fieldName, $conditionName, $prohibitedWhen ) );
					}
				}
				return array( true, $value, null );

			case 'same':
				// Field must match another field's value
				if ( is_null( $param ) ) {
					return array( false, $value, 'same rule requires field name' );
				}
				$otherField = trim( $param );
				$otherValue = $allInput[ $otherField ] ?? null;
				if ( $value !== $otherValue ) {
					$fieldName = self::humanizeFieldName( $path );
					$otherName = self::humanizeFieldName( $otherField );
					return array( false, $value, sprintf( '%s must match %s', $fieldName, $otherName ) );
				}
				return array( true, $value, null );

			case 'one_of':
				// Exactly ONE of the listed fields must be present
				// This is a cross-field rule - validation happens at schema level
				// Individual fields just pass through here
				return array( true, $value, null );

			case 'at_least_one':
				// At least one of the listed fields must be present
				// This is a cross-field rule - validation happens at schema level
				// Individual fields just pass through here
				return array( true, $value, null );

			default:
				// Unknown rule - pass through
				return array( true, $value, null );
		}
	}

	/**
	 * Convert field path to human-readable name
	 *
	 * Examples:
	 * - "email" => "Email"
	 * - "config.redirectUrl" => "Redirect URL"
	 * - "captcha_enabled" => "Captcha Enabled"
	 *
	 * @param string $path Field path
	 * @return string Human-readable name
	 */
	private static function humanizeFieldName( string $path ): string {
		// Get last part of path (e.g., "config.email" => "email")
		$parts = explode( '.', $path );
		$name  = end( $parts );

		// Convert snake_case and camelCase to spaces
		$name = preg_replace( '/([a-z])([A-Z])/', '$1 $2', $name ); // camelCase
		$name = str_replace( '_', ' ', $name ); // snake_case

		// Capitalize words
		$name = ucwords( $name );

		return $name;
	}
}
