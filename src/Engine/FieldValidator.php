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
	 * Types that answer with one value, never a list (FB-23).
	 */
	private const SINGLE_VALUE_TYPES = array(
		'text',
		'email',
		'url',
		'number',
		'phone',
		'tel',
		'password',
		'textarea',
		'rich_text',
		'date',
		'time',
		'datetime',
		'radio',
		'select',
		'dropdown',
		'country',
		'color_picker',
		'rating',
		'net_promoter_score',
		'range_slider',
		'scale',
		'toggle',
		'consent',
		'hidden',
		'signature',
	);

	/**
	 * Types whose input honours Read-only on the live form (FB-07).
	 */
	private const READ_ONLY_TYPES = array(
		'text',
		'email',
		'url',
		'number',
		'phone',
		'tel',
		'password',
		'textarea',
		'date',
		'time',
		'datetime',
		'select',
		'dropdown',
		'country',
	);

	/**
	 * Calling codes whose national numbers keep their leading 0 (Italy, San
	 * Marino and the Vatican).
	 */
	private const KEEPS_TRUNK_ZERO = array( '39', '378' );

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
				// Dropdowns that are not set up are not drawn, so nothing can
				// be answered and the field is never required (RFUN-02).
				if ( ! self::chainedIsSetUp( $fields[ $fieldKey ] ?? array() ) ) {
					continue;
				}
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

			// Rich text with no visible text, such as "<p><br></p>", is empty
			// (FA-17). A phone number that is only a calling code is empty too.
			if ( $type === 'rich_text' || $type === 'phone' || $type === 'tel' ) {
				$blank = $type === 'rich_text' ? self::richTextIsBlank( $value ) : self::phoneIsBlank( $value );
				if ( $blank ) {
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
	 * Put submitted answers in the shape the form stores, before they are
	 * checked: the same steps the browser takes.
	 *
	 * - A Hidden field's value is worked out here, so {date}, {user_email}
	 *   and {user_name} are filled in without JavaScript (FLD2-16). A value
	 *   that reads the page address ({get:param}) keeps what the browser sent.
	 * - A website typed without https:// gets it (FB-15).
	 * - Several email addresses are stored as "a@example.com, b@example.com" (FB-05).
	 * - A phone number with a calling code is stored as "+44 7946095800",
	 *   without the trunk 0 (FLD2-07).
	 *
	 * Repeater groups are prepared with their child fields.
	 *
	 * With $tidy false, websites, email lists and phone numbers keep what the
	 * visitor typed. Conditional logic reads those answers, as the browser
	 * does, so a rule for "example.com" still matches (review of PR #28).
	 *
	 * @param mixed $schema  Form schema.
	 * @param array $payload Submitted values.
	 * @param bool  $tidy    Tidy websites, email lists and phone numbers.
	 * @return array
	 */
	public static function prepare( $schema, array $payload, bool $tidy = true ): array {
		$fields = is_array( $schema ) && isset( $schema['fields'] ) && is_array( $schema['fields'] ) ? $schema['fields'] : array();
		foreach ( self::answerFields( $fields ) as $key => $field ) {
			$type = (string) ( $field['type'] ?? '' );
			if ( 'hidden' === $type ) {
				$raw = self::attr( $field, 'defaultValue' );
				if ( null === $raw || '' === $raw ) {
					$raw = self::attr( $field, 'value' );
				}
				if ( is_scalar( $raw ) && '' !== (string) $raw ) {
					$resolved = self::resolveTokens( (string) $raw );
					if ( null !== $resolved ) {
						$payload[ $key ] = $resolved;
					}
				}
				continue;
			}
			if ( ! array_key_exists( $key, $payload ) ) {
				continue;
			}
			$value = $payload[ $key ];
			if ( \SubtleForms\Support\Repeater::TYPE === $type ) {
				if ( is_array( $value ) ) {
					$child = array( 'fields' => \SubtleForms\Support\Repeater::children( $field ) );
					$groups = array();
					foreach ( \SubtleForms\Support\Repeater::groups( $value ) as $group ) {
						$groups[] = self::prepare( $child, $group, $tidy );
					}
					$payload[ $key ] = $groups;
				}
				continue;
			}
			if ( ! $tidy || ! is_string( $value ) ) {
				continue;
			}
			switch ( $type ) {
				case 'url':
					$payload[ $key ] = self::normalizeUrl( $value );
					break;
				case 'email':
					$payload[ $key ] = true === self::attr( $field, 'allowMultiple' ) ? implode( ', ', self::emailList( $value ) ) : trim( $value );
					break;
				case 'phone':
				case 'tel':
					$payload[ $key ] = self::normalizePhone( $value );
					break;
			}
		}
		return $payload;
	}

	/**
	 * Fields by key, without looking inside Repeaters (their children answer
	 * inside each group).
	 *
	 * @param array $fields Field nodes.
	 * @param array $map    Collected fields.
	 * @return array<string,array>
	 */
	private static function answerFields( array $fields, array &$map = array() ): array {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$key = (string) ( $field['key'] ?? ( is_array( $field['config'] ?? null ) ? ( $field['config']['key'] ?? '' ) : '' ) );
			if ( '' !== $key ) {
				$map[ $key ] = $field;
			}
			if ( \SubtleForms\Support\Repeater::TYPE === ( $field['type'] ?? '' ) ) {
				continue;
			}
			foreach ( array( 'fields', 'children' ) as $nested ) {
				if ( ! empty( $field[ $nested ] ) && is_array( $field[ $nested ] ) ) {
					self::answerFields( $field[ $nested ], $map );
				}
			}
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) ) {
						$list = isset( $column['fields'] ) && is_array( $column['fields'] ) ? $column['fields'] : ( isset( $column['children'] ) && is_array( $column['children'] ) ? $column['children'] : $column );
						self::answerFields( $list, $map );
					}
				}
			}
		}
		return $map;
	}

	/**
	 * Whether a field type collects an answer that can be required.
	 *
	 * Layout and system types never do. Neither does a type no plugin has
	 * registered (for example an add-on field while the add-on is inactive):
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
		// A type with a plain fallback (picture choice) still takes an answer
		// when its add-on is not active: it is checked as the choice it falls back to.
		if ( in_array( $type, \SubtleForms\Fields\FieldTypeAvailability::FALLBACKS, true ) ) {
			return true;
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
	 * Check one submitted value against its field: the same rules the browser
	 * applies, so a crafted request cannot store what the form would refuse.
	 *
	 * @param array $field
	 * @param mixed $value
	 * @return string|null
	 */
	private function validateFieldType( $field, $value ) {
		$type  = isset( $field['type'] ) ? $field['type'] : null;
		$field = is_array( $field ) ? $field : array();

		// A field type with a plain fallback (picture choice) is checked as the
		// choice it falls back to, whether or not its add-on is active: the
		// rules are the same, the add-on only changes how it looks.
		if ( is_string( $type ) ) {
			$type = \SubtleForms\Fields\FieldTypeAvailability::validationType( $type, $field );
		}

		// A field that answers with one value never takes a list (FB-23).
		if ( is_array( $value ) && $this->expectsSingleValue( (string) $type, $field ) ) {
			return __( 'Please enter a single value.', 'subtleforms' );
		}

		// Read-only fields keep the value the form gave them (FB-07).
		$readOnly = $this->validateReadOnly( $field, $value );
		if ( null !== $readOnly ) {
			return $readOnly;
		}

		switch ( $type ) {
			case 'email':
				return $this->validateEmail( $value, $field );
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
				$error = $this->validateChoices( $value, $field, true === $this->attr( $field, 'allowMultiple' ) );
				return $error ?: $this->validateChoiceCount( $value, $field );
			case 'radio':
			case 'select':
			case 'dropdown':
				return $this->validateChoices( $value, $field, false );
			case 'checkbox':
				// An older single checkbox saved with options is a checkbox group.
				$options = $this->attr( $field, 'options' );
				if ( is_array( $options ) && array() !== $options ) {
					return $this->validateChoices( $value, $field, true );
				}
				return $this->validateTick( $value );
			case 'consent':
				return $this->validateTick( $value );
			case 'toggle':
				return $this->validateToggle( $value, $field );
			case 'country':
				return $this->validateCountry( $value );
			case 'chained_select':
				return $this->validateChained( $value, $field );
			case 'scale':
				return $this->validateScale( $value, $field );
			case 'date':
				return $this->validateDate( $value, $field );
			case 'time':
				return $this->validateTime( $value );
			case 'datetime':
				return $this->validateDateTime( $value, $field );
			case 'rating':
				return $this->validateRating( $value, $field );
			case 'net_promoter_score':
				return $this->validateNps( $value );
			case 'range_slider':
				return $this->validateSlider( $value, $field );
			case 'checkbox_grid':
				return $this->validateMatrix( $value, $field );
			case 'color_picker':
				return $this->validateColour( $value );
			case 'phone':
			case 'tel':
				return $this->validatePhone( $value, $field );
			case 'name_group':
			case 'address_group':
				// Grouped fields submit as arrays/objects - no specific validation needed
				// Individual sub-parts are strings and will be sanitized by SaveAction
				return null;
			case 'signature':
				// The Signature field (from an add-on) answers with a drawn
				// PNG or JPEG. Anything else is not a signature (FA-01).
				if ( ! $this->isEmpty( $value ) && ! \SubtleForms\Support\EntryValues::isSignatureImage( $value ) ) {
					return __( 'The signature could not be read. Please sign again.', 'subtleforms' );
				}
				return $this->addonError( $type, $value, $field );
			default:
				return $this->addonError( $type, $value, $field );
		}
	}

	/**
	 * Error from an add-on for its own field type, or null.
	 *
	 * @param string|null $type  Field type.
	 * @param mixed       $value Submitted value.
	 * @param array       $field Field definition.
	 * @return string|null
	 */
	private function addonError( $type, $value, array $field ) {
		/**
		 * Validate a value for a field type an add-on registered. Return an error
		 * message, or null when the value is fine. Unknown types are
		 * otherwise not checked.
		 *
		 * @param string|null $error Default null.
		 * @param string|null $type  Field type.
		 * @param mixed       $value Submitted value.
		 * @param array       $field Field definition from the schema.
		 * @since 2.1.0
		 */
		$error = apply_filters( 'subtleforms/fields/validate_value', null, $type, $value, $field );
		return is_string( $error ) && '' !== $error ? $error : null;
	}

	/**
	 * Whether a field answers with one value.
	 *
	 * @param string $type  Field type.
	 * @param array  $field Field.
	 */
	private function expectsSingleValue( string $type, array $field ): bool {
		if ( 'checkbox' === $type ) {
			$options = $this->attr( $field, 'options' );
			return ! ( is_array( $options ) && array() !== $options );
		}
		return in_array( $type, self::SINGLE_VALUE_TYPES, true );
	}

	/**
	 * A read-only field must keep the value the form filled in (FB-07, FA-01).
	 *
	 * The browser does not let a visitor change it, so another value can only
	 * come from a crafted request. A default that reads the page address
	 * ({get:param}) cannot be known here and is not checked.
	 *
	 * @param array $field Field.
	 * @param mixed $value Submitted value.
	 * @return string|null
	 */
	private function validateReadOnly( array $field, $value ) {
		$flag = $this->attr( $field, 'readOnly' );
		if ( true !== $flag && 1 !== $flag && '1' !== $flag && 'true' !== $flag ) {
			return null;
		}
		$type = (string) ( $field['type'] ?? '' );
		if ( ! in_array( $type, self::READ_ONLY_TYPES, true ) || $this->isEmpty( $value ) || ! is_scalar( $value ) ) {
			return null;
		}
		$expected = self::readOnlyValues( $field );
		if ( null === $expected ) {
			return null;
		}
		$given = self::comparable( $type, $value );
		foreach ( $expected as $candidate ) {
			$want = self::comparable( $type, $candidate );
			if ( $want === $given ) {
				return null;
			}
			// With a country picker the dial code is added in front of the
			// default number.
			if ( ( 'phone' === $type || 'tel' === $type ) && '' !== $want && str_ends_with( $given, ltrim( $want, '0' ) ) ) {
				return null;
			}
		}
		return __( 'This field cannot be changed.', 'subtleforms' );
	}

	/**
	 * Values a read-only field may hold: its default, with tokens resolved.
	 *
	 * @param array $field Field.
	 * @return string[]|null Null when the default cannot be worked out here.
	 */
	private static function readOnlyValues( array $field ): ?array {
		$raw = self::attr( $field, 'defaultValue' );
		if ( ( null === $raw || '' === $raw ) && 'country' === ( $field['type'] ?? '' ) ) {
			$raw = self::attr( $field, 'default_country' );
		}
		if ( null === $raw || '' === $raw ) {
			return array( '' );
		}
		if ( ! is_scalar( $raw ) ) {
			return null;
		}
		$raw = (string) $raw;
		if ( false === strpos( $raw, '{' ) ) {
			return array( $raw );
		}
		// {date} is the visitor's local date, which can be a day either side
		// of the site's date.
		$out = array();
		foreach ( array( 0, -1, 1 ) as $offset ) {
			$resolved = self::resolveTokens( $raw, $offset );
			if ( null === $resolved ) {
				return null;
			}
			$out[] = $resolved;
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * A value in a form that can be compared with a default.
	 *
	 * @param string $type  Field type.
	 * @param mixed  $value Value.
	 */
	private static function comparable( string $type, $value ): string {
		$text = trim( (string) $value );
		if ( 'number' === $type && is_numeric( $text ) ) {
			return (string) (float) $text;
		}
		if ( 'phone' === $type || 'tel' === $type ) {
			return (string) preg_replace( '/\D/', '', $text );
		}
		if ( 'country' === $type ) {
			return strtoupper( $text );
		}
		// Compare read-only URL defaults and submitted values after identical normalization.
		if ( 'url' === $type ) {
			return self::normalizeUrl( $text );
		}
		return $text;
	}

	/**
	 * Resolve the default value tokens the server knows: {date},
	 * {user_email} and {user_name}. Mirrors resolveTokens() in
	 * resources/frontend/utils/defaults.js.
	 *
	 * @param string $raw       Text with tokens.
	 * @param int    $dayOffset Days added to {date}.
	 * @return string|null Null when the text reads the page address ({get:param}).
	 */
	private static function resolveTokens( string $raw, int $dayOffset = 0 ): ?string {
		if ( false === strpos( $raw, '{' ) ) {
			return $raw;
		}
		$unknown = false;
		$out     = preg_replace_callback(
			'/\{([a-z_]+)(?::([^}]+))?\}/i',
			static function ( $match ) use ( &$unknown, $dayOffset ) {
				switch ( strtolower( $match[1] ) ) {
					case 'date':
						$time = time() + $dayOffset * 86400;
						return function_exists( 'wp_date' ) ? (string) wp_date( 'Y-m-d', $time ) : gmdate( 'Y-m-d', $time );
					case 'user_email':
						$user = function_exists( 'wp_get_current_user' ) ? wp_get_current_user() : null;
						return $user && ! empty( $user->ID ) ? (string) $user->user_email : '';
					case 'user_name':
						$user = function_exists( 'wp_get_current_user' ) ? wp_get_current_user() : null;
						return $user && ! empty( $user->ID ) ? (string) $user->display_name : '';
					case 'get':
						$unknown = true;
						return '';
					default:
						return $match[0];
				}
			},
			$raw
		);
		return $unknown ? null : (string) $out;
	}

	/**
	 * Values offered by a field's choices.
	 *
	 * @param array $field Field.
	 * @return string[]
	 */
	private function optionValues( array $field ): array {
		$options = $this->attr( $field, 'options' );
		$out     = array();
		if ( ! is_array( $options ) ) {
			return $out;
		}
		foreach ( $options as $option ) {
			if ( is_array( $option ) ) {
				$value = $option['value'] ?? null;
				if ( null === $value || '' === $value ) {
					$value = $option['label'] ?? null;
				}
			} else {
				$value = $option;
			}
			if ( is_scalar( $value ) && '' !== (string) $value ) {
				$out[] = (string) $value;
			}
		}
		return $out;
	}

	/**
	 * Every answer must be one of the field's choices (FB-11, PAY-07), and a
	 * pick-one field takes one answer (PAY-08).
	 *
	 * @param mixed $value    Value.
	 * @param array $field    Field.
	 * @param bool  $multiple Whether several choices may be picked.
	 * @return string|null
	 */
	private function validateChoices( $value, array $field, bool $multiple ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$values = array_values( array_filter( is_array( $value ) ? $value : array( $value ), static fn( $v ) => $v !== '' && $v !== null && $v !== false ) );
		if ( ! $multiple && count( $values ) > 1 ) {
			return __( 'Please choose only one option.', 'subtleforms' );
		}
		$allowed = $this->optionValues( $field );
		// A field with no choices of its own (filled by an add-on) is not checked.
		if ( array() === $allowed ) {
			return null;
		}
		foreach ( $values as $v ) {
			if ( ! is_scalar( $v ) || ! in_array( (string) $v, $allowed, true ) ) {
				return self::notAnOption();
			}
		}
		return null;
	}

	/**
	 * The message for an answer that is not one of the choices.
	 */
	private static function notAnOption(): string {
		return __( 'Please choose one of the options shown.', 'subtleforms' );
	}

	/**
	 * A single checkbox or consent box is ticked or not (FB-11).
	 *
	 * @param mixed $value Value.
	 * @return string|null
	 */
	private function validateTick( $value ) {
		if ( is_bool( $value ) || null === $value || 0 === $value || 1 === $value ) {
			return null;
		}
		if ( is_string( $value ) && in_array( strtolower( trim( $value ) ), array( '', '0', '1', 'true', 'false' ), true ) ) {
			return null;
		}
		return self::notAnOption();
	}

	/**
	 * A toggle is on or off, as its settings name them (FB-11).
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateToggle( $value, array $field ) {
		if ( null === $this->validateTick( $value ) ) {
			return null;
		}
		$on  = (string) ( $this->attr( $field, 'onValue' ) ?? 'yes' );
		$off = (string) ( $this->attr( $field, 'offValue' ) ?? 'no' );
		if ( is_scalar( $value ) && in_array( (string) $value, array( $on, $off ), true ) ) {
			return null;
		}
		return self::notAnOption();
	}

	/**
	 * A country is a code or a name from the country list (FB-11).
	 *
	 * @param mixed $value Value.
	 * @return string|null
	 */
	private function validateCountry( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		if ( ! is_scalar( $value ) ) {
			return self::notAnOption();
		}
		$text  = trim( (string) $value );
		$names = \SubtleForms\Fields\CountryList::getAll();
		if ( isset( $names[ strtoupper( $text ) ] ) || in_array( $text, $names, true ) || in_array( $text, \SubtleForms\Fields\CountryList::englishNames(), true ) ) {
			return null;
		}
		return self::notAnOption();
	}

	/**
	 * Every level of a chained dropdown must be one of the choices that level
	 * offers for the answers before it (FB-11).
	 *
	 * @param mixed $value Value, one answer per level.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateChained( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$selected = is_array( $value ) ? array_values( $value ) : array( $value );
		foreach ( $selected as $depth => $answer ) {
			if ( null === $answer || '' === $answer ) {
				continue;
			}
			if ( ! is_scalar( $answer ) ) {
				return self::notAnOption();
			}
			$found = false;
			foreach ( $this->chainedOptions( $field, $selected, (int) $depth ) as $opt ) {
				if ( is_array( $opt ) && (string) ( $opt['value'] ?? '' ) === (string) $answer ) {
					$found = true;
					break;
				}
			}
			if ( ! $found ) {
				return self::notAnOption();
			}
		}
		return null;
	}

	/**
	 * A date is a real calendar day, YYYY-MM-DD.
	 *
	 * @param mixed $value Value.
	 */
	private static function isIsoDate( $value ): bool {
		if ( ! is_string( $value ) || ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m ) ) {
			return false;
		}
		return checkdate( (int) $m[2], (int) $m[3], (int) $m[1] );
	}

	/**
	 * A time is HH:MM on the 24-hour clock, seconds optional.
	 *
	 * @param mixed $value Value.
	 */
	private static function isClockTime( $value ): bool {
		return is_string( $value ) && 1 === preg_match( '/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $value );
	}

	/**
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateDate( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		if ( ! self::isIsoDate( $value ) ) {
			return __( 'Please enter a valid date.', 'subtleforms' );
		}
		return $this->validateDateBounds( $value, $field );
	}

	/**
	 * @param mixed $value Value.
	 * @return string|null
	 */
	private function validateTime( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		return self::isClockTime( $value ) ? null : __( 'Please enter a valid time.', 'subtleforms' );
	}

	/**
	 * A date and time is YYYY-MM-DDTHH:MM; the time may be left out.
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateDateTime( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$parts = is_string( $value ) ? preg_split( '/[T ]/', $value, 2 ) : array();
		$date  = $parts[0] ?? '';
		$time  = $parts[1] ?? null;
		if ( ! self::isIsoDate( $date ) || ( null !== $time && ! self::isClockTime( $time ) ) ) {
			return __( 'Please enter a valid date and time.', 'subtleforms' );
		}
		return $this->validateDateBounds( $date, $field );
	}

	/**
	 * A whole number, or null.
	 *
	 * @param mixed $value Value.
	 */
	private static function wholeNumber( $value ): ?int {
		if ( is_int( $value ) ) {
			return $value;
		}
		if ( ( is_string( $value ) || is_float( $value ) ) && is_numeric( $value ) && (float) $value === floor( (float) $value ) ) {
			return (int) $value;
		}
		return null;
	}

	/**
	 * A star rating is a whole number from 1 to the number of stars.
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateRating( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$max   = (int) ( $this->attr( $field, 'max' ) ?: 5 );
		$max   = $max > 0 ? $max : 5;
		$stars = self::wholeNumber( $value );
		if ( null === $stars || $stars < 1 || $stars > $max ) {
			/* translators: %d: number of stars */
			return sprintf( __( 'Please choose a rating from 1 to %d.', 'subtleforms' ), $max );
		}
		return null;
	}

	/**
	 * A Net Promoter Score is a whole number from 0 to 10.
	 *
	 * @param mixed $value Value.
	 * @return string|null
	 */
	private function validateNps( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$score = self::wholeNumber( $value );
		if ( null === $score || $score < 0 || $score > 10 ) {
			return __( 'Please choose a score from 0 to 10.', 'subtleforms' );
		}
		return null;
	}

	/**
	 * A slider value lies between its minimum and maximum, on its step.
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateSlider( $value, array $field ) {
		$error = $this->validateNumber( $value );
		if ( $error ) {
			return $error;
		}
		$min  = $this->attr( $field, 'min' );
		$max  = $this->attr( $field, 'max' );
		$step = $this->attr( $field, 'step' );
		return $this->validateNumberRange(
			$value,
			array(
				'min'  => is_numeric( $min ) ? $min : 0,
				'max'  => is_numeric( $max ) ? $max : 100,
				'step' => is_numeric( $step ) ? $step : 1,
			)
		);
	}

	/**
	 * Matrix answers name its rows and columns (FA-01).
	 *
	 * @param mixed $value Value: row => column, or row => { column: ticked }.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateMatrix( $value, array $field ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		$rows = $this->attr( $field, 'rows' );
		$cols = $this->attr( $field, 'columns' );
		if ( ! is_array( $value ) || ! is_array( $rows ) || ! is_array( $cols ) ) {
			return self::notAnOption();
		}
		$rowKeys = array_map( array( $this, 'matrixRowKey' ), $rows );
		$colKeys = array_map( array( $this, 'matrixRowKey' ), $cols );
		$single  = false === $this->attr( $field, 'multiplePerRow' );
		foreach ( $value as $row => $answer ) {
			if ( ! in_array( (string) $row, $rowKeys, true ) ) {
				return self::notAnOption();
			}
			if ( null === $answer || '' === $answer ) {
				continue;
			}
			if ( is_scalar( $answer ) ) {
				if ( ! in_array( (string) $answer, $colKeys, true ) ) {
					return self::notAnOption();
				}
				continue;
			}
			if ( $single || ! is_array( $answer ) ) {
				return self::notAnOption();
			}
			foreach ( $answer as $col => $cell ) {
				if ( ! in_array( (string) $col, $colKeys, true ) || null !== $this->validateTick( $cell ) ) {
					return self::notAnOption();
				}
			}
		}
		return null;
	}

	/**
	 * A colour is a hex value such as #336699 (FA-01).
	 *
	 * @param mixed $value Value.
	 * @return string|null
	 */
	private function validateColour( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}
		if ( ! is_string( $value ) || ! preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', trim( $value ) ) ) {
			return __( 'Please enter a colour as a hex value, such as #336699.', 'subtleforms' );
		}
		return null;
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
			/* translators: %s: minimum value */
			return sprintf( __( 'Must be at least %s.', 'subtleforms' ), $this->formatNumber( (float) $min ) );
		}

		if ( $max !== null && $max !== '' && is_numeric( $max ) && $float > (float) $max ) {
			/* translators: %s: maximum value */
			return sprintf( __( 'Must be no more than %s.', 'subtleforms' ), $this->formatNumber( (float) $max ) );
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
	 * Email addresses in a value: one, or a comma separated list when the
	 * field allows several.
	 *
	 * @param string $value Value.
	 * @return string[]
	 */
	private static function emailList( string $value ): array {
		return array_values( array_filter( array_map( 'trim', preg_split( '/[,;]/', $value ) ), static fn( $v ) => '' !== $v ) );
	}

	/**
	 * Check an email address, or each address when the field allows several
	 * (FB-05). With RFC validation off the check only needs a name, an @ and
	 * a domain, so an address such as user@localhost passes (FB-06).
	 *
	 * @param mixed $value Value.
	 * @param array $field Field.
	 * @return string|null
	 */
	private function validateEmail( $value, array $field = array() ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		$invalid = __( 'Invalid email address.', 'subtleforms' );
		if ( ! is_string( $value ) ) {
			return $invalid;
		}
		$list   = true === $this->attr( $field, 'allowMultiple' ) ? self::emailList( $value ) : array( trim( $value ) );
		$strict = ! in_array( $this->attr( $field, 'rfcValidation' ), array( false, 0, '0', 'false' ), true );
		if ( array() === $list ) {
			return $invalid;
		}
		foreach ( $list as $address ) {
			$ok = $strict ? false !== filter_var( $address, FILTER_VALIDATE_EMAIL ) : 1 === preg_match( '/^[^\s@,;]+@[^\s@,;]+$/', $address );
			if ( ! $ok ) {
				return $invalid;
			}
		}

		return null;
	}

	/**
	 * A website address with https:// in front when the visitor typed only
	 * the domain (FB-15). Anything else is returned as it was.
	 *
	 * @param string $value Value.
	 */
	public static function normalizeUrl( string $value ): string {
		$value = trim( $value );
		if ( '' === $value || false !== strpos( $value, '://' ) ) {
			return $value;
		}
		if ( preg_match( '#^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?([/?\#]\S*)?$#i', $value ) ) {
			return 'https://' . $value;
		}
		return $value;
	}

	/**
	 * A website is an http or https address, the browser's rule (FB-15).
	 *
	 * @param mixed $value
	 * @return string|null
	 */
	private function validateUrl( $value ) {
		if ( $this->isEmpty( $value ) ) {
			return null;
		}

		$url = is_string( $value ) ? self::normalizeUrl( $value ) : '';
		if ( ! preg_match( '#^https?://\S+$#i', $url ) || ! filter_var( $url, FILTER_VALIDATE_URL ) ) {
			return __( 'Invalid URL.', 'subtleforms' );
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
			return __( 'Please enter a number.', 'subtleforms' );
		}

		$float = (float) $value;
		if ( is_infinite( $float ) || is_nan( $float ) ) {
			return __( 'Please enter a number.', 'subtleforms' );
		}

		return null;
	}

	/**
	 * The calling code at the start of an international number, the longest
	 * one that matches.
	 *
	 * @param string $digits Digits after the "+".
	 * @return string|null
	 */
	private static function dialCodeOf( string $digits ): ?string {
		$codes = array_unique( array_values( \SubtleForms\Fields\CountryList::dialCodes() ) );
		usort( $codes, static fn( $a, $b ) => strlen( $b ) <=> strlen( $a ) );
		foreach ( $codes as $code ) {
			if ( str_starts_with( $digits, $code ) ) {
				return $code;
			}
		}
		return null;
	}

	/**
	 * An international number as "+{code} {digits}", the shape the phone
	 * field stores, with the trunk 0 dropped (FLD2-07). A number that is
	 * only a calling code becomes empty. Other values are returned as they were.
	 *
	 * @param string $value Value.
	 */
	public static function normalizePhone( string $value ): string {
		$value = trim( $value );
		if ( ! str_starts_with( $value, '+' ) || ! preg_match( '/^[\d\s\-\+\(\)]+$/', $value ) ) {
			return $value;
		}
		$digits = (string) preg_replace( '/\D/', '', $value );
		$dial   = self::dialCodeOf( $digits );
		if ( null === $dial ) {
			return $value;
		}
		$national = substr( $digits, strlen( $dial ) );
		if ( '' === $national ) {
			return '';
		}
		if ( ! in_array( $dial, self::KEEPS_TRUNK_ZERO, true ) ) {
			$national = (string) preg_replace( '/^0/', '', $national );
		}
		return '+' . $dial . ' ' . $national;
	}

	/**
	 * Whether a phone answer holds no number: empty, or a calling code only.
	 *
	 * @param mixed $value Value.
	 */
	private static function phoneIsBlank( $value ): bool {
		if ( null === $value || ( is_string( $value ) && '' === trim( $value ) ) || ( is_array( $value ) && array() === $value ) ) {
			return true;
		}
		return is_string( $value ) && str_starts_with( trim( $value ), '+' ) && '' === self::normalizePhone( $value );
	}

	/**
	 * A phone number: digits, spaces, dashes, brackets and "+". An
	 * international number needs a real calling code and a number of the
	 * right length: 10 digits for +1, otherwise 4 or more and at most 15 in
	 * all (E.164) (FLD2-07).
	 *
	 * @param mixed $value
	 * @return string|null
	 */
	private function validatePhone( $value, array $field = array() ) {
		if ( self::phoneIsBlank( $value ) ) {
			return null;
		}

		$invalid = __( 'Invalid phone number.', 'subtleforms' );
		if ( ! is_string( $value ) || ! preg_match( '/^[\d\s\-\+\(\)]+$/', $value ) ) {
			return $invalid;
		}

		if ( 'us' === (string) $this->attr( $field, 'format' ) ) {
			$digits = (string) preg_replace( '/\D/', '', $value );
			// A country prefix is not part of the 10-digit US length.
			if ( str_starts_with( trim( $value ), '+' ) ) {
				$dial = self::dialCodeOf( $digits );
				if ( null !== $dial ) {
					$digits = substr( $digits, strlen( $dial ) );
				}
			}
			if ( 10 !== strlen( $digits ) ) {
				return __( 'Enter a 10-digit US phone number.', 'subtleforms' );
			}
			return null;
		}

		if ( ! str_starts_with( trim( $value ), '+' ) ) {
			return null;
		}
		$digits = (string) preg_replace( '/\D/', '', $value );
		$dial   = self::dialCodeOf( $digits );
		if ( null === $dial ) {
			return $invalid;
		}
		$national = strlen( $digits ) - strlen( $dial );
		$ok       = '1' === $dial ? 10 === $national : ( $national >= 4 && strlen( $digits ) <= 15 );
		return $ok ? null : $invalid;
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
			return __( 'The passwords do not match.', 'subtleforms' );
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
	private static function attr( array $field, string $name ) {
		// The browser's rule (fieldConfig.js): the config value wins unless it
		// is blank and the flat one is not. The builder stores some settings
		// flat, such as a Custom Amount's minimum and maximum (PAY-05).
		$flat = $field[ $name ] ?? null;
		if ( isset( $field['config'] ) && is_array( $field['config'] ) && array_key_exists( $name, $field['config'] ) ) {
			$nested = $field['config'][ $name ];
			if ( ( null === $nested || '' === $nested ) && null !== $flat && '' !== $flat ) {
				return $flat;
			}
			return $nested;
		}
		return $flat;
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
			// A paragraph-long label is shortened in the message (FLD2-12).
			/* translators: %s: field label */
			return sprintf( __( '%s is required.', 'subtleforms' ), \SubtleForms\Support\AnswerFormatter::shorten( $label ) );
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
	 * Whether a chained field has any dropdown to show a visitor. Mirrors
	 * isAnswerable() for chained_select in the browser: a field with no
	 * choices is not drawn (RFUN-02).
	 *
	 * @param array $field Field.
	 */
	public static function chainedIsSetUp( array $field ): bool {
		$levels = self::attr( $field, 'levels' );
		if ( is_array( $levels ) && array() !== $levels ) {
			foreach ( array_values( $levels ) as $depth => $level ) {
				$options = is_array( $level ) && isset( $level['options'] ) && is_array( $level['options'] ) ? $level['options'] : array();
				if ( array() === $options ) {
					continue;
				}
				$linked = false;
				foreach ( $options as $opt ) {
					if ( is_array( $opt ) && isset( $opt['parent'] ) && '' !== (string) $opt['parent'] ) {
						$linked = true;
						break;
					}
				}
				if ( 0 === $depth || ! $linked ) {
					return true;
				}
			}
			return false;
		}
		$options = self::attr( $field, 'options' );
		return is_array( $options ) && array() !== $options;
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
		$selected   = is_array( $value ) ? array_values( $value ) : ( is_scalar( $value ) && '' !== (string) $value ? array( (string) $value ) : array() );
		$levels     = $this->attr( $field, 'levels' );
		$levels     = is_array( $levels ) && array() !== $levels ? array_values( $levels ) : null;
		$optionsFor = function ( int $depth ) use ( $field, $selected ): array {
			return $this->chainedOptions( $field, $selected, $depth );
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
	 * Choices a level of a chained field offers for the answers before it.
	 * Mirrors resources/shared/chainedOptions.js.
	 *
	 * @param array $field    Field.
	 * @param array $selected Answers, one per level.
	 * @param int   $depth    Level.
	 * @return array
	 */
	private function chainedOptions( array $field, array $selected, int $depth ): array {
		$levels = $this->attr( $field, 'levels' );
		$levels = is_array( $levels ) && array() !== $levels ? array_values( $levels ) : null;
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
	}

	/**
	 * Whether rich text has nothing a reader would see, such as
	 * "<p><br></p>" (FA-17). Same rule as hasVisibleText() in the browser.
	 *
	 * @param mixed $value Value.
	 */
	private static function richTextIsBlank( $value ): bool {
		if ( null === $value || ( is_array( $value ) && array() === $value ) ) {
			return true;
		}
		if ( ! is_string( $value ) ) {
			return false;
		}
		if ( preg_match( '/<(img|iframe|video|svg|hr)\b/i', $value ) ) {
			return false;
		}
		$text = (string) preg_replace( '/<[^>]*>/', '', $value );
		return '' === (string) preg_replace( '/&nbsp;|\s|\x{00A0}/u', '', $text );
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
}
