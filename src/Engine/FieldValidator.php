<?php

declare(strict_types=1);

namespace SubtleForms\Engine;

use SubtleForms\Fields\CompositeParts;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates field values with conditional logic support.
 */
final class FieldValidator {

	/** @var array<string, mixed> */
	private $payload = array();

	/**
	 * Form-level default messages for the current validate() call.
	 *
	 * @var array{requiredMessage: string, validationMessage: string}
	 */
	private $defaultMessages = array(
		'requiredMessage'   => '',
		'validationMessage' => '',
	);

	/**
	 * Field types that are structural or system-level and cannot be marked as required.
	 * These types do not accept or submit user input.
	 */
	private const NON_INPUT_TYPES = array(
		// Layout structural types
		'section_break',
		'disclaimer',
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
		'html',
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
		$this->payload = $payload;
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

		// Form-level default messages (2.3.2): used when a field has none.
		$metadata             = isset( $schema['metadata'] ) && is_array( $schema['metadata'] ) ? $schema['metadata'] : array();
		$this->defaultMessages = array(
			'requiredMessage'   => isset( $metadata['requiredMessage'] ) && is_string( $metadata['requiredMessage'] ) ? trim( $metadata['requiredMessage'] ) : '',
			'validationMessage' => isset( $metadata['validationMessage'] ) && is_string( $metadata['validationMessage'] ) ? trim( $metadata['validationMessage'] ) : '',
		);

		// Validate required fields
		foreach ( $requiredFields as $fieldKey ) {
			$value    = $payload[ $fieldKey ] ?? null;
			$type     = $fields[ $fieldKey ]['type'] ?? '';
			$isComposite = in_array( $type, array( 'name_group', 'address_group' ), true );

			// A required checkbox/consent must be ticked: an unchecked box is
			// `false`, which the generic isEmpty() does not treat as missing.
			// Without this, a required consent could be bypassed by skipping the
			// frontend check and submitting `false` directly.
			$requiredMessage = $this->requiredMessage( $fields[ $fieldKey ] ?? array(), $fieldKey );

			// A matrix with no rows or columns is not drawn, so it cannot be
			// answered and is never required (2.2.1, bug 8). A drawn matrix is
			// required only when every row has an answer.
			if ( $type === 'checkbox_grid' ) {
				$rows = $this->attr( $fields[ $fieldKey ] ?? array(), 'rows' );
				$cols = $this->attr( $fields[ $fieldKey ] ?? array(), 'columns' );
				if ( empty( $rows ) || empty( $cols ) || ! is_array( $rows ) || ! is_array( $cols ) ) {
					continue;
				}
				$missing = $this->firstUnansweredMatrixRow( $rows, $value );
				if ( null !== $missing ) {
					/* translators: %s: matrix row label */
					$errors[ $fieldKey ] = sprintf( __( 'Please answer the "%s" row.', 'subtleforms' ), $missing );
				}
				continue;
			}

			// An older single checkbox saved with options is drawn as a
			// checkbox group and answers with a list (2.2.1, bug 7).
			if ( $type === 'checkbox' && is_array( $value ) ) {
				if ( count( array_filter( $value, static fn( $v ) => $v !== '' && $v !== null && $v !== false ) ) === 0 ) {
					$errors[ $fieldKey ] = $requiredMessage;
				}
				continue;
			}

			if ( in_array( $type, array( 'checkbox', 'consent' ), true ) ) {
				$accepted = is_bool( $value ) ? $value : filter_var( $value, FILTER_VALIDATE_BOOLEAN );
				if ( ! $accepted ) {
					$errors[ $fieldKey ] = $requiredMessage;
				}
				continue;
			}

			// Every dependent dropdown that offers choices needs an answer,
			// the same rule as the browser (FLD2-10).
			if ( $type === 'chained_select' ) {
				if ( null !== $this->chainedMissingLevel( $fields[ $fieldKey ] ?? array(), $value ) ) {
					$errors[ $fieldKey ] = $requiredMessage;
				}
				continue;
			}

			if ( $type === 'toggle' ) {
				$onValue = (string) ( $this->attr( $fields[ $fieldKey ] ?? array(), 'onValue' ) ?? 'yes' );
				if ( $value !== true && (string) $value !== $onValue ) {
					$errors[ $fieldKey ] = $requiredMessage;
				}
				continue;
			}

			// Name and Address demand every part they draw except the optional
			// ones, the same rule as the browser (FB-10).
			if ( $isComposite ? array() !== CompositeParts::missing( $type, $fields[ $fieldKey ] ?? array(), $value ) : $this->isEmpty( $value ) ) {
				$errors[ $fieldKey ] = $requiredMessage;
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
				// The field's Custom validation message replaces the standard
				// format, range and pattern messages (2.3.2).
				$errors[ $key ] = $this->validationMessage( $field ) ?? $typeError;
			}
		}

		return array(
			'valid'  => empty( $errors ),
			'errors' => $errors,
		);
	}

	/**
	 * Whether a field type collects an answer that can be required.
	 *
	 * Layout and system types never do. Neither does a type no plugin has
	 * registered (for example a Pro field on a site without SubtleForms Pro):
	 * the live form does not show it, so it cannot be required either.
	 *
	 * @param string $type Field type.
	 */
	private function acceptsInput( string $type ): bool {
		/**
		 * Field types that never collect an answer.
		 *
		 * @since 2.3.9
		 *
		 * @param string[] $types Types.
		 */
		$nonInput = (array) apply_filters( 'subtleforms/fields/non_input_types', self::NON_INPUT_TYPES );
		if ( in_array( $type, $nonInput, true ) ) {
			return false;
		}
		$registry = self::registry();
		return null === $registry || '' === $type || $registry->has( $type );
	}

	/**
	 * The field registry, when the plugin is booted.
	 */
	private static function registry(): ?\SubtleForms\Fields\FieldRegistry {
		try {
			$registry = \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Fields\FieldRegistry::class );
		} catch ( \Throwable $e ) {
			return null;
		}
		return $registry instanceof \SubtleForms\Fields\FieldRegistry ? $registry : null;
	}

	/**
	 * Extract required fields from schema.
	 */
	private function extractRequiredFields( array $fields, array &$required = array() ): array {
		foreach ( $fields as $field ) {
			$type   = $field['type'] ?? '';

			// Skip layout and system types, they do not accept user input and cannot be required
			$isRequired = ! empty( $field['required'] ) || ! empty( $field['config']['required'] );
			if ( $isRequired && $this->acceptsInput( (string) $type ) ) {
				$required[] = $field['key'];
			}

			// Process nested fields (step/container types use 'fields' key)
			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$this->extractRequiredFields( $field['fields'], $required );
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

			// Process nested fields (step/container types use 'fields' key)
			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$this->flattenFields( $field['fields'], $map );
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
				$error = $this->validateTextLength( $value, $field );
				return $error ?: $this->validatePattern( $value, $field );
			case 'textarea':
				return $this->validateTextLength( $value, $field );
			case 'password':
				$lengthError = $this->validateTextLength( $value, $field );
				if ( $lengthError ) {
					return $lengthError;
				}
				return $this->validatePasswordConfirm( $value, $field );
			case 'multiple_choice':
			case 'picture_choice':
				return $this->validateChoiceCount( $value, $field );
			case 'scale':
				return $this->validateScale( $value, $field );
			case 'date':
				return $this->validateDateBounds( $value, $field );
			case 'phone':
				return $this->validatePhone( $value, $field );
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
				/**
				 * Validate a value for a field type an add-on registered (for
				 * example the WooCommerce Product field). Return an error
				 * message, or null when the value is fine. Unknown types are
				 * otherwise not checked.
				 *
				 * @param string|null $error Default null.
				 * @param string|null $type  Field type.
				 * @param mixed       $value Submitted value.
				 * @param array       $field Field definition from the schema.
				 * @since 2.1.0
				 */
				$error = apply_filters( 'subtleforms/fields/validate_value', null, $type, $value, is_array( $field ) ? $field : array() );
				return is_string( $error ) && '' !== $error ? $error : null;
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

		$maxLength = $this->attr( $field, 'maxLength' );
		$maxLength = ( $maxLength !== null && $maxLength !== '' ) ? intval( $maxLength ) : null;
		$minLength = $this->attr( $field, 'minLength' );
		$minLength = ( $minLength !== null && $minLength !== '' ) ? intval( $minLength ) : null;

		if ( $maxLength !== null && $maxLength > 0 && is_string( $value ) && mb_strlen( $value ) > $maxLength ) {
			/* translators: %d: maximum number of characters */
			return sprintf( __( 'Must be %d characters or fewer.', 'subtleforms' ), $maxLength );
		}

		if ( $minLength !== null && $minLength > 0 && is_string( $value ) && mb_strlen( $value ) < $minLength ) {
			/* translators: %d: minimum number of characters */
			return sprintf( __( 'Must be at least %d characters.', 'subtleforms' ), $minLength );
		}

		return null;
	}

	/**
	 * Validate number field min, max, and step constraints.
	 *
	 * Step uses the same base as the number input: min when it is set, otherwise 0.
	 *
	 * @param mixed $value
	 * @param array $field
	 * @return string|null
	 */
	private function validateNumberRange( $value, array $field ) {
		if ( $this->isEmpty( $value ) || ! is_numeric( $value ) ) {
			return null;
		}

		$float = (float) $value;
		$min   = $this->attr( $field, 'min' );
		$max   = $this->attr( $field, 'max' );

		if ( $min !== null && $min !== '' && is_numeric( $min ) && $float < (float) $min ) {
			return sprintf( 'Must be at least %s.', $this->formatNumber( (float) $min ) );
		}

		if ( $max !== null && $max !== '' && is_numeric( $max ) && $float > (float) $max ) {
			return sprintf( 'Cannot exceed %s.', $this->formatNumber( (float) $max ) );
		}

		$step = $this->attr( $field, 'step' );
		if ( $step !== null && $step !== '' && is_numeric( $step ) ) {
			$step_value = (float) $step;
			if ( $step_value > 0 ) {
				$base = ( $min !== null && $min !== '' && is_numeric( $min ) ) ? (float) $min : 0.0;
				$quot = ( $float - $base ) / $step_value;
				if ( abs( $quot - round( $quot ) ) > 1.0e-8 ) {
					/* translators: %s: step increment */
					return sprintf( __( 'Must match the step of %s.', 'subtleforms' ), $this->formatNumber( $step_value ) );
				}
			}
		}

		return null;
	}
	private function formatNumber( float $number ): string {
		$formatted = number_format( $number, 2, '.', '' );
		return rtrim( rtrim( $formatted, '0' ), '.' );
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
	private function validatePhone( $value, array $field = array() ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		if ( ! is_string( $value ) || ! preg_match( '/^[\d\s\-\+\(\)]+$/', $value ) ) {
			return 'Invalid phone number.';
		}

		if ( 'us' === (string) $this->attr( $field, 'format' ) ) {
			$digits = preg_replace( '/\D/', '', $value );
			if ( 10 !== strlen( (string) $digits ) ) {
				return 'Enter a 10-digit US phone number.';
			}
		}

		return null;
	}

	/**
	 * Confirmation is stored beside the password as `{key}_confirm`.
	 *
	 * @param mixed $value Password.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validatePasswordConfirm( $value, array $field ) {
		if ( empty( $this->attr( $field, 'requireConfirmation' ) ) || $this->isEmpty( $value ) ) {
			return null;
		}
		$key     = (string) ( $field['key'] ?? ( $field['config']['key'] ?? '' ) );
		$confirm = $this->payload[ $key . '_confirm' ] ?? null;
		if ( (string) $confirm !== (string) $value ) {
			return 'The passwords do not match.';
		}
		return null;
	}

	/**
	 * Reject a date outside the field's min and max.
	 *
	 * HTML min/max do not run: the form uses noValidate.
	 *
	 * @param mixed $value Submitted value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateDateBounds( $value, array $field ) {
		if ( $this->isEmpty( $value ) || ! is_string( $value ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return null;
		}

		$min = $this->attr( $field, 'minDate' );
		$max = $this->attr( $field, 'maxDate' );

		if ( is_string( $min ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $min ) && $value < $min ) {
			/* translators: %s: earliest allowed date */
			return sprintf( __( 'Date must be on or after %s.', 'subtleforms' ), $min );
		}

		if ( is_string( $max ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $max ) && $value > $max ) {
			/* translators: %s: latest allowed date */
			return sprintf( __( 'Date must be on or before %s.', 'subtleforms' ), $max );
		}

		return null;
	}

	/**
	 * Label of the first matrix row with no answer.
	 *
	 * @param array $rows  Configured rows.
	 * @param mixed $value Submitted grid.
	 * @return string|null
	 */
	private function firstUnansweredMatrixRow( array $rows, $value ): ?string {
		$grid = is_array( $value ) ? $value : array();
		foreach ( $rows as $row ) {
			$key    = $this->matrixRowKey( $row );
			$answer = ( '' !== $key && array_key_exists( $key, $grid ) ) ? $grid[ $key ] : null;
			if ( ! $this->matrixRowAnswered( $answer ) ) {
				return $this->matrixRowLabel( $row );
			}
		}
		return null;
	}

	/**
	 * @param mixed $row Row definition.
	 * @return string
	 */
	private function matrixRowKey( $row ): string {
		if ( is_array( $row ) ) {
			if ( isset( $row['value'] ) && $row['value'] !== '' && $row['value'] !== null ) {
				return (string) $row['value'];
			}
			if ( isset( $row['label'] ) && $row['label'] !== '' && $row['label'] !== null ) {
				return (string) $row['label'];
			}
			return '';
		}
		return (string) $row;
	}

	/**
	 * @param mixed $row Row definition.
	 * @return string
	 */
	private function matrixRowLabel( $row ): string {
		if ( is_array( $row ) ) {
			if ( isset( $row['label'] ) && $row['label'] !== '' && $row['label'] !== null ) {
				return (string) $row['label'];
			}
			if ( isset( $row['value'] ) && $row['value'] !== '' && $row['value'] !== null ) {
				return (string) $row['value'];
			}
			return '';
		}
		return (string) $row;
	}

	/**
	 * A row is answered by a column key, or by at least one checked cell.
	 *
	 * @param mixed $answer Row value.
	 * @return bool
	 */
	private function matrixRowAnswered( $answer ): bool {
		if ( is_string( $answer ) ) {
			return trim( $answer ) !== '';
		}
		if ( is_int( $answer ) || is_float( $answer ) ) {
			return true;
		}
		if ( ! is_array( $answer ) ) {
			return false;
		}
		foreach ( $answer as $cell ) {
			if ( true === $cell || 1 === $cell || '1' === $cell ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Read a field attribute from the flat shape or its config.
	 *
	 * @param array  $field Field.
	 * @param string $name  Attribute.
	 * @return mixed
	 */
	private function attr( array $field, string $name ) {
		if ( isset( $field['config'] ) && is_array( $field['config'] ) && array_key_exists( $name, $field['config'] ) ) {
			return $field['config'][ $name ];
		}
		return $field[ $name ] ?? null;
	}

	/**
	 * Human required-field message: the field's own message, else its label.
	 *
	 * @param array  $field Field.
	 * @param string $key   Field key.
	 * @return string
	 */
	private function requiredMessage( array $field, string $key ): string {
		$custom = $this->attr( $field, 'requiredMessage' );
		if ( is_string( $custom ) && trim( $custom ) !== '' ) {
			return trim( $custom );
		}
		if ( '' !== $this->defaultMessages['requiredMessage'] ) {
			return $this->defaultMessages['requiredMessage'];
		}
		$label = $this->attr( $field, 'label' );
		if ( is_string( $label ) && trim( $label ) !== '' ) {
			/* translators: %s: field label */
			return sprintf( __( '%s is required.', 'subtleforms' ), wp_strip_all_tags( $label ) );
		}
		/* translators: %s: field key */
		return sprintf( __( 'Field "%s" is required.', 'subtleforms' ), $key );
	}

	/**
	 * The field's Custom validation message, else the form's (2.3.2).
	 *
	 * @param array $field Field.
	 * @return string|null Null when neither is set.
	 */
	private function validationMessage( array $field ): ?string {
		$custom = $this->attr( $field, 'validationMessage' );
		if ( is_string( $custom ) && trim( $custom ) !== '' ) {
			return wp_strip_all_tags( trim( $custom ) );
		}
		if ( '' !== $this->defaultMessages['validationMessage'] ) {
			return wp_strip_all_tags( $this->defaultMessages['validationMessage'] );
		}
		return null;
	}

	/**
	 * Validate a text value against the field's regular expression.
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validatePattern( $value, array $field ) {
		$pattern = $this->attr( $field, 'pattern' );
		if ( $this->isEmpty( $value ) || ! is_string( $pattern ) || $pattern === '' || ! is_string( $value ) ) {
			return null;
		}
		$regex = '/' . str_replace( '/', '\/', $pattern ) . '/u';
		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- an invalid admin regex must not break submissions.
		$match = @preg_match( $regex, $value );
		if ( $match === 0 ) {
			$message = $this->attr( $field, 'patternMessage' );
			return ( is_string( $message ) && $message !== '' ) ? $message : __( 'Please match the requested format.', 'subtleforms' );
		}
		return null;
	}

	/**
	 * Enforce minimum/maximum selections on multi-choice fields.
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateChoiceCount( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$count = is_array( $value ) ? count( array_filter( $value, static fn( $v ) => $v !== '' && $v !== null && $v !== false ) ) : 1;
		$min   = (int) ( $this->attr( $field, 'minChoices' ) ?? 0 );
		$max   = (int) ( $this->attr( $field, 'maxChoices' ) ?? 0 );
		if ( $min > 0 && $count < $min ) {
			/* translators: %d: minimum number of selections */
			return sprintf( _n( 'Select at least %d option.', 'Select at least %d options.', $min, 'subtleforms' ), $min );
		}
		if ( $max > 0 && $count > $max ) {
			/* translators: %d: maximum number of selections */
			return sprintf( _n( 'Select no more than %d option.', 'Select no more than %d options.', $max, 'subtleforms' ), $max );
		}
		return null;
	}

	/**
	 * Opinion scale values must fall inside the configured range.
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateScale( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		if ( ! is_numeric( $value ) ) {
			return __( 'Please choose a value on the scale.', 'subtleforms' );
		}
		$min = (int) ( $this->attr( $field, 'scaleMin' ) ?? 1 );
		$max = (int) ( $this->attr( $field, 'scaleMax' ) ?? 5 );
		$v   = (int) $value;
		if ( $v < $min || $v > $max ) {
			return __( 'Please choose a value on the scale.', 'subtleforms' );
		}
		return null;
	}

	/**
	 * The first level of a chained field that offers choices for the answers
	 * so far but has no valid answer. Mirrors firstUnansweredChainedLevel()
	 * in resources/shared/chainedOptions.js.
	 *
	 * @param array $field Field.
	 * @param mixed $value Answer, one choice per level.
	 * @return int|null Depth, or null when every level is answered.
	 */
	private function chainedMissingLevel( array $field, $value ): ?int {
		$selected = is_array( $value ) ? array_values( $value ) : ( is_scalar( $value ) && '' !== (string) $value ? array( (string) $value ) : array() );
		$levels   = $this->attr( $field, 'levels' );
		$levels   = is_array( $levels ) && array() !== $levels ? array_values( $levels ) : null;

		$optionsFor = function ( int $depth ) use ( $levels, $field, $selected ): array {
			if ( null !== $levels ) {
				$options = isset( $levels[ $depth ]['options'] ) && is_array( $levels[ $depth ]['options'] ) ? $levels[ $depth ]['options'] : array();
				$linked  = false;
				foreach ( $options as $opt ) {
					if ( is_array( $opt ) && isset( $opt['parent'] ) && '' !== (string) $opt['parent'] ) {
						$linked = true;
						break;
					}
				}
				if ( 0 === $depth || ! $linked ) {
					return $options;
				}
				$parent = $selected[ $depth - 1 ] ?? '';
				if ( ! is_scalar( $parent ) || '' === (string) $parent ) {
					return array();
				}
				return array_values( array_filter( $options, static fn( $o ) => is_array( $o ) && (string) ( $o['parent'] ?? '' ) === (string) $parent ) );
			}
			$nodes = $this->attr( $field, 'options' );
			$nodes = is_array( $nodes ) ? $nodes : array();
			for ( $i = 0; $i < $depth; $i++ ) {
				$chosen = null;
				foreach ( $nodes as $node ) {
					if ( is_array( $node ) && isset( $selected[ $i ] ) && is_scalar( $selected[ $i ] ) && (string) ( $node['value'] ?? '' ) === (string) $selected[ $i ] ) {
						$chosen = $node;
						break;
					}
				}
				$nodes = is_array( $chosen['children'] ?? null ) ? $chosen['children'] : array();
			}
			return $nodes;
		};

		if ( null !== $levels ) {
			$count = count( $levels );
		} else {
			$count = 1;
			foreach ( array_keys( $selected ) as $i ) {
				if ( array() !== $optionsFor( $i + 1 ) ) {
					++$count;
				}
			}
		}

		for ( $depth = 0; $depth < $count; $depth++ ) {
			$options = $optionsFor( $depth );
			if ( array() === $options ) {
				continue;
			}
			$answer = $selected[ $depth ] ?? null;
			$valid  = false;
			if ( is_scalar( $answer ) && '' !== (string) $answer ) {
				foreach ( $options as $opt ) {
					if ( is_array( $opt ) && (string) ( $opt['value'] ?? '' ) === (string) $answer ) {
						$valid = true;
						break;
					}
				}
			}
			if ( ! $valid ) {
				return $depth;
			}
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
