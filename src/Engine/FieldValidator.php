<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Validates field values with conditional logic support.
 */
final class FieldValidator {

	/**
	 * Field types that are structural or system-level and cannot be marked as required.
	 * These types do not accept or submit user input.
	 */
	private const NON_INPUT_TYPES = array(
		// Layout structural types
		'section_break',
		'form_step',
		'repeat_field',
		'one_column_container',
		'two_column_container',
		'three_column_container',
		'four_column_container',
		'five_column_container',
		'six_column_container',
		'repeat_container',
		'group_container',
		'step',
		// System / non-input types
		'hidden',
	);

	/**
	 * Validate submission payload against schema fields.
	 *
	 * @param array<string,mixed> $schema
	 * @param array<string,mixed> $payload
	 * @param array<string,mixed> $conditionalState
	 * @return array{valid: bool, errors: array<string,string>}
	 */
	public function validate( array $schema, array $payload, array $conditionalState ): array {
		$errors         = array();
		$hiddenFields   = $conditionalState['hidden_fields'] ?? array();
		$requiredFields = array_merge(
			$this->extractRequiredFields( $schema['fields'] ?? array() ),
			$conditionalState['required_fields'] ?? array()
		);

		// Remove conditionally hidden fields from required list
		$requiredFields = array_diff( $requiredFields, $hiddenFields );

		// Flatten fields map (needed for both required check and type validation)
		$fields = $this->flattenFields( $schema['fields'] ?? array() );

		// Validate required fields
		foreach ( $requiredFields as $fieldKey ) {
			$value    = $payload[ $fieldKey ] ?? null;
			$type     = $fields[ $fieldKey ]['type'] ?? '';
			$isComposite = in_array( $type, array( 'name_group', 'address_group' ), true );

			if ( $isComposite ? $this->isCompositeEmpty( $value ) : $this->isEmpty( $value ) ) {
				$errors[ $fieldKey ] = sprintf( 'Field "%s" is required.', $fieldKey );
			}
		}

		// Type validation for submitted fields
		foreach ( $payload as $key => $value ) {
			// Skip hidden fields
			if ( in_array( $key, $hiddenFields, true ) ) {
				continue;
			}

			$field = $fields[ $key ] ?? null;
			if ( ! $field ) {
				continue;
			}

			$typeError = $this->validateFieldType( $field, $value );
			if ( $typeError ) {
				$errors[ $key ] = $typeError;
			}
		}

		return array(
			'valid'  => empty( $errors ),
			'errors' => $errors,
		);
	}

	/**
	 * Extract required fields from schema.
	 */
	private function extractRequiredFields( array $fields, array &$required = array() ): array {
		foreach ( $fields as $field ) {
			$type   = $field['type'] ?? '';
			$config = $field['config'] ?? array();

			// Skip layout and system types — they do not accept user input and cannot be required
			if ( ! in_array( $type, self::NON_INPUT_TYPES, true ) && ! empty( $config['required'] ) ) {
				$required[] = $field['key'];
			}

			// Process nested fields
			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$this->extractRequiredFields( $field['children'], $required );
			}

			// Process columns
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) ) {
						$this->extractRequiredFields( $column, $required );
					}
				}
			}
		}

		return $required;
	}

	/**
	 * Flatten nested fields into key => field map.
	 */
	private function flattenFields( array $fields, array &$map = array() ): array {
		foreach ( $fields as $field ) {
			if ( ! empty( $field['key'] ) ) {
				$map[ $field['key'] ] = $field;
			}

			// Process nested fields
			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$this->flattenFields( $field['children'], $map );
			}

			// Process columns
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) ) {
						$this->flattenFields( $column, $map );
					}
				}
			}
		}

		return $map;
	}

	/**
	 * @param array $field
	 * @param mixed $value
	 * @return string|null
	 */
	private function validateFieldType( $field, $value ) {
		$type = isset( $field['type'] ) ? $field['type'] : null;

		switch ( $type ) {
			case 'email':
				return $this->validateEmail( $value );
			case 'url':
				return $this->validateUrl( $value );
			case 'number':
				$error = $this->validateNumber( $value );
				if ( $error ) {
					return $error;
				}
				return $this->validateNumberRange( $value, $field );
			case 'text':
			case 'textarea':
			case 'password':
				return $this->validateTextLength( $value, $field );
			case 'phone':
				return $this->validatePhone( $value );
			case 'payment_amount':
				return $this->validatePaymentAmount( $value, $field );
			case 'payment_coupon':
				return $this->validatePaymentCoupon( $value, $field );
			case 'name_group':
			case 'address_group':
				// Grouped fields submit as arrays/objects - no specific validation needed
				// Individual sub-parts are strings and will be sanitized by SaveAction
				return null;
			default:
				// Unknown field types are ignored for safety
				return null;
		}
	}

	/**
	 * Validate text/textarea/password maxLength constraint.
	 *
	 * @param mixed $value
	 * @param array $field
	 * @return string|null
	 */
	private function validateTextLength( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		$config    = $field['config'] ?? array();
		$maxLength = isset( $config['maxLength'] ) ? intval( $config['maxLength'] ) : null;

		if ( $maxLength !== null && $maxLength > 0 && is_string( $value ) && mb_strlen( $value ) > $maxLength ) {
			return sprintf( 'Must be %d characters or fewer.', $maxLength );
		}

		return null;
	}

	/**
	 * Validate number field min/max range constraints.
	 *
	 * @param mixed $value
	 * @param array $field
	 * @return string|null
	 */
	private function validateNumberRange( $value, array $field ) {
		if ( $this->isEmpty( $value ) || ! is_numeric( $value ) ) {
			return null;
		}

		$config = $field['config'] ?? array();
		$float  = (float) $value;

		if ( isset( $config['min'] ) && $config['min'] !== null && $config['min'] !== '' ) {
			$min = (float) $config['min'];
			if ( $float < $min ) {
				return sprintf( 'Must be at least %s.', $this->formatNumber( $min ) );
			}
		}

		if ( isset( $config['max'] ) && $config['max'] !== null && $config['max'] !== '' ) {
			$max = (float) $config['max'];
			if ( $float > $max ) {
				return sprintf( 'Cannot exceed %s.', $this->formatNumber( $max ) );
			}
		}

		return null;
	}

	/**
	 * Format a number for display in error messages — strip unnecessary trailing zeros.
	 *
	 * @param float $number
	 * @return string
	 */
	private function formatNumber( float $number ): string {
		$formatted = number_format( $number, 2, '.', '' );
		return rtrim( rtrim( $formatted, '0' ), '.' );
	}

	/**
	 * Check if a composite field value (array) is empty (all sub-values empty).
	 *
	 * @param mixed $value
	 * @return bool
	 */
	private function isCompositeEmpty( $value ): bool {
		if ( ! is_array( $value ) || empty( $value ) ) {
			return true;
		}
		foreach ( $value as $v ) {
			if ( ! $this->isEmpty( $v ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param mixed $value
	 * @return string|null
	 */
	private function validateEmail( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_string( $value ) || ! filter_var( $value, FILTER_VALIDATE_EMAIL ) ) {
			return 'Invalid email address.';
		}

		return null;
	}

	/**
	 * @param mixed $value
	 * @return string|null
	 */
	private function validateUrl( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_string( $value ) || ! filter_var( $value, FILTER_VALIDATE_URL ) ) {
			return 'Invalid URL.';
		}

		return null;
	}

	/**
	 * @param mixed $value
	 * @return string|null
	 */
	private function validateNumber( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_numeric( $value ) ) {
			return 'Must be a valid number.';
		}

		$float = (float) $value;
		if ( is_infinite( $float ) || is_nan( $float ) ) {
			return 'Must be a valid finite number.';
		}

		return null;
	}

	/**
	 * @param mixed $value
	 * @return string|null
	 */
	private function validatePhone( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_string( $value ) || ! preg_match( '/^[\d\s\-\+\(\)]+$/', $value ) ) {
			return 'Invalid phone number.';
		}

		return null;
	}

	/**
	 * @param mixed $value
	 * @return bool
	 */
	private function isEmpty( $value ) {
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
	 * Validate payment amount field.
	 *
	 * @param mixed $value
	 * @param array $field
	 * @return string|null
	 */
	private function validatePaymentAmount( $value, $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_numeric( $value ) ) {
			return 'Payment amount must be a valid number.';
		}

		$amount = floatval( $value );
		$config = $field['config'] ?? array();

		// Must be positive
		if ( $amount < 0 ) {
			return 'Payment amount must be positive.';
		}

		// Check minimum
		$min = isset( $config['min'] ) ? floatval( $config['min'] ) : 0;
		if ( $amount < $min ) {
			return sprintf( 'Payment amount must be at least %s.', number_format( $min, 2 ) );
		}

		// Check maximum
		if ( isset( $config['max'] ) ) {
			$max = floatval( $config['max'] );
			if ( $amount > $max ) {
				return sprintf( 'Payment amount cannot exceed %s.', number_format( $max, 2 ) );
			}
		}

		return null;
	}

	/**
	 * Validate payment coupon field.
	 *
	 * @param mixed $value
	 * @param array $field
	 * @return string|null
	 */
	private function validatePaymentCoupon( $value, $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_string( $value ) ) {
			return 'Coupon code must be a string.';
		}

		$config    = $field['config'] ?? array();
		$maxLength = isset( $config['maxLength'] ) ? intval( $config['maxLength'] ) : 50;

		if ( strlen( $value ) > $maxLength ) {
			return sprintf( 'Coupon code cannot exceed %d characters.', $maxLength );
		}

		// Basic sanitization check - alphanumeric and common special chars only
		if ( ! preg_match( '/^[a-zA-Z0-9\-_]+$/', $value ) ) {
			return 'Coupon code contains invalid characters.';
		}

		return null;
	}
}
