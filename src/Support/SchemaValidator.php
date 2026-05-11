<?php
declare(strict_types=1);

/**
 * SubtleForms Schema Validator
 *
 * Canonical Form Schema (JSON/PHP shape):
 * {
 *   "metadata": {
 *     "id": 123,              // optional server-side id
 *     "name": "Contact form",
 *     "status": "draft|published|archived",
 *     "description": "..."
 *   },
 *   "fields": [
 *     {
 *       "type": "text|email|number|select|checkbox|radio|textarea|hidden|date",
 *       "key": "email",
 *       "label": "Email",
 *       "settings": { ... },
 *       "validations": { ... }
 *     }
 *   ],
 *   "logic": [
 *     { "if": {"field":"age","operator":">=","value":18}, "then": {"action":"show","target":"field_key"} }
 *   ],
 *   "actions": [
 *     { "type": "email|webhook|save|custom", "settings": {...}, "requires": ["actions.email"] }
 *   ],
 *   // version is managed by storage; optional client-supplied value ignored
 * }
 */

namespace SubtleForms\Support;

use InvalidArgumentException;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Plugin;

final class SchemaValidator {

	/**
	 * Allowed field types for freemium core. Extensions may add more.
	 *
	 * @var string[]
	 */
	private array $allowedFieldTypes;

	private const FALLBACK_ALLOWED_FIELD_TYPES = array(
		'text',
		'email',
		'textarea',
		'number',
		'phone',
		'url',
		'password',
		'checkbox',
		'radio',
		'multiple_choice',
		'dropdown',
		'select',
		'country',
		'chained_select',
		'date',
		'time',
		'datetime',
		'image_upload',
		'file_upload',
		'rating',
		'range_slider',
		'color_picker',
		'rich_text',
		'net_promoter_score',
		'checkbox_grid',
		'dynamic_field',
		'post_selection',
		'html',
		'hidden',
		'address',
		'section_break',
		'form_step',
		'step',
		'repeat_field',
		'one_column_container',
		'two_column_container',
		'three_column_container',
		'four_column_container',
		'five_column_container',
		'six_column_container',
		'repeat_container',
		'group_container',
		'recaptcha',
		'hcaptcha',
		'turnstile',
		'action_hook',
		'save_resume',
	);

	public function __construct( ?array $allowedFieldTypes = null ) {
		$this->allowedFieldTypes = $this->resolveAllowedFieldTypes( $allowedFieldTypes );
	}

	private function resolveAllowedFieldTypes( ?array $allowedFieldTypes ): array {
		if ( is_array( $allowedFieldTypes ) && ! empty( $allowedFieldTypes ) ) {
			return array_values( array_unique( array_map( 'strval', $allowedFieldTypes ) ) );
		}

		if ( class_exists( Plugin::class ) ) {
			try {
				$registry = Plugin::instance()->get( FieldRegistry::class );
				if ( $registry instanceof FieldRegistry ) {
					$types = array_keys( $registry->all() );
					if ( ! empty( $types ) ) {
						// include legacy aliases such as 'select'
						$types[] = 'select';
						return array_values( array_unique( $types ) );
					}
				}
			} catch ( \Throwable $e ) {
				// Fallback handled below
			}
		}

		return self::FALLBACK_ALLOWED_FIELD_TYPES;
	}

	/**
	 * Validate schema array. Throws InvalidArgumentException on first failure.
	 */
	public function validate( array $schema ): bool {
		// Schema version is required (root level)
		if ( ! isset( $schema['schema_version'] ) ) {
			throw new InvalidArgumentException( 'Schema must contain a schema_version field.' );
		}

		if ( ! is_int( $schema['schema_version'] ) || $schema['schema_version'] < 1 ) {
			throw new InvalidArgumentException( 'schema_version must be a positive integer.' );
		}

		// Root checks
		if ( empty( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			throw new InvalidArgumentException( 'Schema must contain a metadata object.' );
		}

		if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
			throw new InvalidArgumentException( 'Metadata.name is required and must be a string.' );
		}

		// Status if present
		if ( isset( $schema['metadata']['status'] ) && ! in_array( $schema['metadata']['status'], array( 'draft', 'published', 'archived' ), true ) ) {
			throw new InvalidArgumentException( 'Metadata.status must be one of draft, published or archived.' );
		}

		// Fields
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			throw new InvalidArgumentException( 'Schema must include a fields array.' );
		}

		$keys = array();
		foreach ( $schema['fields'] as $i => $field ) {
			if ( ! is_array( $field ) ) {
				throw new InvalidArgumentException( "Each field must be an object (index {$i})." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( empty( $field['type'] ) || ! is_string( $field['type'] ) ) {
				throw new InvalidArgumentException( "Field at index {$i} must have a string 'type'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( ! in_array( $field['type'], $this->allowedFieldTypes, true ) ) {
				throw new InvalidArgumentException( "Field type '{$field['type']}' at index {$i} is not allowed." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( empty( $field['key'] ) || ! is_string( $field['key'] ) ) {
				throw new InvalidArgumentException( "Field at index {$i} must have a string 'key'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( ! preg_match( '/^[a-zA-Z0-9_]+$/', $field['key'] ) ) {
				throw new InvalidArgumentException( "Field key '{$field['key']}' at index {$i} contains invalid characters." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( in_array( $field['key'], $keys, true ) ) {
				throw new InvalidArgumentException( "Duplicate field key '{$field['key']}' at index {$i}." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
			$keys[] = $field['key'];

			if ( isset( $field['label'] ) && ! is_string( $field['label'] ) ) {
				throw new InvalidArgumentException( "Field label for '{$field['key']}' must be a string." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( isset( $field['settings'] ) && ! is_array( $field['settings'] ) ) {
				throw new InvalidArgumentException( "Field settings for '{$field['key']}' must be an object." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( isset( $field['validations'] ) && ! is_array( $field['validations'] ) ) {
				throw new InvalidArgumentException( "Field validations for '{$field['key']}' must be an object." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			// Validate field-level conditions
			if ( isset( $field['config']['conditions'] ) && ! is_array( $field['config']['conditions'] ) ) {
				throw new InvalidArgumentException( "Field conditions for '{$field['key']}' must be an array." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}

			if ( isset( $field['config']['conditions'] ) && is_array( $field['config']['conditions'] ) ) {
				foreach ( $field['config']['conditions'] as $ci => $cond ) {
					if ( ! is_array( $cond ) ) {
						throw new InvalidArgumentException( "Condition {$ci} for field '{$field['key']}' must be an object." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}

					if ( empty( $cond['sourceField'] ) || ! is_string( $cond['sourceField'] ) ) {
						throw new InvalidArgumentException( "Condition {$ci} for field '{$field['key']}' must have a string 'sourceField'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}

					if ( empty( $cond['operator'] ) || ! is_string( $cond['operator'] ) ) {
						throw new InvalidArgumentException( "Condition {$ci} for field '{$field['key']}' must have a string 'operator'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}

					if ( empty( $cond['effect'] ) || ! is_string( $cond['effect'] ) ) {
						throw new InvalidArgumentException( "Condition {$ci} for field '{$field['key']}' must have a string 'effect'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
					}
				}
			}
		}

		// Conditional logic (permissive but structured)
		if ( isset( $schema['logic'] ) ) {
			if ( ! is_array( $schema['logic'] ) ) {
				throw new InvalidArgumentException( 'Schema.logic must be an array of rules.' );
			}

			foreach ( $schema['logic'] as $i => $rule ) {
				if ( ! is_array( $rule ) || ! isset( $rule['if'] ) || ! isset( $rule['then'] ) ) {
					throw new InvalidArgumentException( "Logic rule at index {$i} must contain 'if' and 'then' objects." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				$cond = $rule['if'];
				if ( ! is_array( $cond ) || empty( $cond['field'] ) || empty( $cond['operator'] ) || ! array_key_exists( 'value', $cond ) ) {
					throw new InvalidArgumentException( "Logic.if at index {$i} must contain 'field','operator' and 'value'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				if ( ! is_string( $cond['field'] ) || ! is_string( $cond['operator'] ) ) {
					throw new InvalidArgumentException( "Logic.if.field and operator must be strings at index {$i}." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				$then = $rule['then'];
				if ( ! is_array( $then ) || empty( $then['action'] ) ) {
					throw new InvalidArgumentException( "Logic.then at index {$i} must contain an 'action' key." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
			}
		}

		// Actions (pipeline steps) validation
		if ( isset( $schema['actions'] ) ) {
			if ( ! is_array( $schema['actions'] ) ) {
				throw new InvalidArgumentException( 'Schema.actions must be an array.' );
			}

			foreach ( $schema['actions'] as $i => $act ) {
				if ( ! is_array( $act ) || empty( $act['type'] ) || ! is_string( $act['type'] ) ) {
					throw new InvalidArgumentException( "Action at index {$i} must be an object with string 'type'." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				if ( isset( $act['settings'] ) && ! is_array( $act['settings'] ) ) {
					throw new InvalidArgumentException( "Action.settings for '{$act['type']}' must be an object." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				if ( isset( $act['requires'] ) && ! is_array( $act['requires'] ) ) {
					throw new InvalidArgumentException( "Action.requires for '{$act['type']}' must be an array of capability strings." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}

				if ( isset( $act['skippable'] ) && ! is_bool( $act['skippable'] ) ) {
					throw new InvalidArgumentException( "Action.skippable for '{$act['type']}' must be boolean." ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
			}
		}

		// If version present, ensure integer
		if ( isset( $schema['version'] ) && ! is_int( $schema['version'] ) ) {
			throw new InvalidArgumentException( 'Schema.version must be an integer when present.' );
		}

		return true;
	}

	/**
	 * Validate schema and return structured errors instead of throwing.
	 *
	 * Error shape:
	 * - path: string (e.g. "metadata.title", "fields[0].key")
	 * - message: string
	 * - fieldKey?: string (when applicable)
	 * - index?: int (when applicable)
	 */
	public function validateWithErrors( array $schema ): array {
		$errors = array();

		$push = static function ( array &$errors, string $path, string $message, array $meta = array() ): void {
			$errors[] = array_merge(
				array(
					'path'    => $path,
					'message' => $message,
				),
				$meta
			);
		};

		if ( ! isset( $schema['schema_version'] ) ) {
			$push( $errors, 'schema_version', 'Schema must contain a schema_version field.' );
		} elseif ( ! is_int( $schema['schema_version'] ) || $schema['schema_version'] < 1 ) {
			$push( $errors, 'schema_version', 'schema_version must be a positive integer.' );
		}

		if ( empty( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$push( $errors, 'metadata', 'Schema must contain a metadata object.' );
		} else {
			if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
				$push( $errors, 'metadata.name', 'Metadata.name is required and must be a string.' );
			}

			if (
				isset( $schema['metadata']['status'] ) &&
				! in_array( $schema['metadata']['status'], array( 'draft', 'published', 'archived' ), true )
			) {
				$push( $errors, 'metadata.status', 'Metadata.status must be one of draft, published or archived.' );
			}
		}

		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			$push( $errors, 'fields', 'Schema must include a fields array.' );
		} else {
			$keys = array();
			foreach ( $schema['fields'] as $i => $field ) {
				if ( ! is_array( $field ) ) {
					$push( $errors, "fields[{$i}]", "Each field must be an object (index {$i}).", array( 'index' => $i ) );
					continue;
				}

				$fieldKey = isset( $field['key'] ) && is_string( $field['key'] ) ? $field['key'] : null;

				if ( empty( $field['type'] ) || ! is_string( $field['type'] ) ) {
					$push(
						$errors,
						"fields[{$i}].type",
						"Field at index {$i} must have a string 'type'.",
						array_filter(
							array(
								'index'    => $i,
								'fieldKey' => $fieldKey,
							),
							fn( $v ) => $v !== null
						)
					);
				} elseif ( ! in_array( $field['type'], $this->allowedFieldTypes, true ) ) {
					$push(
						$errors,
						"fields[{$i}].type",
						"Field type '{$field['type']}' at index {$i} is not allowed.",
						array_filter(
							array(
								'index'    => $i,
								'fieldKey' => $fieldKey,
							),
							fn( $v ) => $v !== null
						)
					);
				}

				if ( empty( $field['key'] ) || ! is_string( $field['key'] ) ) {
					$push( $errors, "fields[{$i}].key", "Field at index {$i} must have a string 'key'.", array( 'index' => $i ) );
				} else {
					if ( ! preg_match( '/^[a-zA-Z0-9_]+$/', $field['key'] ) ) {
						$push(
							$errors,
							"fields[{$i}].key",
							"Field key '{$field['key']}' at index {$i} contains invalid characters.",
							array(
								'index'    => $i,
								'fieldKey' => $field['key'],
							)
						);
					}

					if ( in_array( $field['key'], $keys, true ) ) {
						$push(
							$errors,
							"fields[{$i}].key",
							"Duplicate field key '{$field['key']}' at index {$i}.",
							array(
								'index'    => $i,
								'fieldKey' => $field['key'],
							)
						);
					} else {
						$keys[] = $field['key'];
					}
				}

				if ( isset( $field['label'] ) && ! is_string( $field['label'] ) ) {
					$push(
						$errors,
						"fields[{$i}].label",
						"Field label for '{$fieldKey}' must be a string.",
						array_filter(
							array(
								'index'    => $i,
								'fieldKey' => $fieldKey,
							),
							fn( $v ) => $v !== null
						)
					);
				}

				if ( isset( $field['settings'] ) && ! is_array( $field['settings'] ) ) {
					$push(
						$errors,
						"fields[{$i}].settings",
						"Field settings for '{$fieldKey}' must be an object.",
						array_filter(
							array(
								'index'    => $i,
								'fieldKey' => $fieldKey,
							),
							fn( $v ) => $v !== null
						)
					);
				}

				if ( isset( $field['validations'] ) && ! is_array( $field['validations'] ) ) {
					$push(
						$errors,
						"fields[{$i}].validations",
						"Field validations for '{$fieldKey}' must be an object.",
						array_filter(
							array(
								'index'    => $i,
								'fieldKey' => $fieldKey,
							),
							fn( $v ) => $v !== null
						)
					);
				}
			}
		}

		if ( isset( $schema['logic'] ) && ! is_array( $schema['logic'] ) ) {
			$push( $errors, 'logic', 'Schema.logic must be an array of rules.' );
		}

		if ( isset( $schema['actions'] ) && ! is_array( $schema['actions'] ) ) {
			$push( $errors, 'actions', 'Schema.actions must be an array.' );
		}

		if ( isset( $schema['version'] ) && ! is_int( $schema['version'] ) ) {
			$push( $errors, 'version', 'Schema.version must be an integer when present.' );
		}

		return $errors;
	}

	/**
	 * Validate schema for publishing (stricter rules than draft).
	 * Ensures form is ready for public use.
	 */
	public function validateForPublishing( array $schema ): bool {
		// First run standard validation
		$this->validate( $schema );

		// Additional publishing requirements
		if ( empty( $schema['fields'] ) || count( $schema['fields'] ) === 0 ) {
			throw new InvalidArgumentException( 'Cannot publish: Form must contain at least one field.' );
		}

		// Ensure metadata has a title for published forms
		if ( empty( $schema['metadata']['title'] ) || trim( $schema['metadata']['title'] ) === '' ) {
			throw new InvalidArgumentException( 'Cannot publish: Form must have a title.' );
		}

		// Check for at least one input field (not just containers/layout)
		$inputFieldTypes = array(
			'text',
			'email',
			'textarea',
			'number',
			'phone',
			'url',
			'password',
			'checkbox',
			'radio',
			'multiple_choice',
			'dropdown',
			'select',
			'date',
			'time',
			'datetime',
			'file_upload',
			'image_upload',
		);

		$hasInputField = $this->hasInputFieldRecursive( $schema['fields'], $inputFieldTypes );

		if ( ! $hasInputField ) {
			throw new InvalidArgumentException( 'Cannot publish: Form must contain at least one input field (not just layout elements).' );
		}

		return true;
	}

	/**
	 * Publishing validation with structured errors (no exceptions).
	 */
	public function validateForPublishingWithErrors( array $schema ): array {
		$errors = $this->validateWithErrors( $schema );

		$push = static function ( array &$errors, string $path, string $message, array $meta = array() ): void {
			$errors[] = array_merge(
				array(
					'path'    => $path,
					'message' => $message,
				),
				$meta
			);
		};

		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) || count( $schema['fields'] ) === 0 ) {
			$push( $errors, 'fields', 'Cannot publish: Form must contain at least one field.' );
		}

		if (
			empty( $schema['metadata'] ) ||
			! is_array( $schema['metadata'] ) ||
			empty( $schema['metadata']['title'] ) ||
			trim( (string) $schema['metadata']['title'] ) === ''
		) {
			$push( $errors, 'metadata.title', 'Cannot publish: Form must have a title.' );
		}

		$inputFieldTypes = array(
			'text',
			'email',
			'textarea',
			'number',
			'phone',
			'url',
			'password',
			'checkbox',
			'radio',
			'multiple_choice',
			'dropdown',
			'select',
			'date',
			'time',
			'datetime',
			'file_upload',
			'image_upload',
		);

		if ( isset( $schema['fields'] ) && is_array( $schema['fields'] ) && count( $schema['fields'] ) > 0 ) {
			$hasInputField = $this->hasInputFieldRecursive( $schema['fields'], $inputFieldTypes );

			if ( ! $hasInputField ) {
				$push(
					$errors,
					'fields',
					'Cannot publish: Form must contain at least one input field (not just layout elements).'
				);
			}
		}

		return $errors;
	}

	private function hasInputFieldRecursive( array $fields, array $inputFieldTypes ): bool {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}

			if ( isset( $field['type'] ) && in_array( $field['type'], $inputFieldTypes, true ) ) {
				return true;
			}

			// 'children' is the canonical key written by the JS serializer (denormalizeTree).
			// 'fields' is the legacy key kept for backward-compat.
			foreach ( array( 'children', 'fields' ) as $childKey ) {
				if ( isset( $field[ $childKey ] ) && is_array( $field[ $childKey ] ) ) {
					if ( $this->hasInputFieldRecursive( $field[ $childKey ], $inputFieldTypes ) ) {
						return true;
					}
				}
			}
		}

		return false;
	}
}
