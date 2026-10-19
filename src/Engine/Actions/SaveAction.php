<?php

declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Repositories\SubmissionsRepository;

final class SaveAction implements ActionInterface {

	/**
	 * @var SubmissionsRepository
	 */
	private $subsRepo;

	/**
	 * @var FieldValidator
	 */
	private $validator;

	/**
	 * @param SubmissionsRepository $subsRepo
	 * @param FieldValidator|null   $validator
	 */
	public function __construct( $subsRepo, $validator = null ) {
		$this->subsRepo   = $subsRepo;
		$this->validator = $validator ?? new FieldValidator();
	}

	public function id(): string {
		return 'save'; }

	public function label(): string {
		return 'Save submission'; }

	public function validate(): bool {
		return true; }

	public function handle( SubmissionContext $context ): void {
		$submissionId = $context->getMeta( 'submission_id' );
		if ( empty( $submissionId ) || ! is_int( $submissionId ) ) {
			throw new \RuntimeException( 'SaveAction requires a submission_id in context meta.' );
		}

		// Validate with conditional logic
		$schema = $context->getMeta( 'form_schema' );
		if ( is_array( $schema ) ) {
			// Task 1: Normalize field schema shape, ensure id, type, label, config on every node
			$schema = $this->normalize_schema_fields( $schema );
			$context->setMeta( 'form_schema', $schema );

			$conditionalState = $context->getMeta(
				'conditional_state',
				array(
					'hidden_fields'   => array(),
					'required_fields' => array(),
					'disabled_fields' => array(),
					'hidden_steps'    => array(),
				)
			);

			// Repeater groups are checked one by one: each group's children
			// are validated under keys like `companies.0.ticker` (2.3.1).
			$expanded   = \SubtleForms\Support\Repeater::expandForValidation( $schema, $context->payload );
			$validation = $this->validator->validate( $expanded['schema'], $expanded['payload'], $conditionalState );
			$countErrors = \SubtleForms\Support\Repeater::countErrors( $schema, $context->payload, (array) ( $conditionalState['hidden_fields'] ?? array() ) );
			if ( $countErrors ) {
				$validation['errors'] = array_merge( $validation['errors'], $countErrors );
				$validation['valid']  = false;
			}

			if ( ! $validation['valid'] ) {
				$context->setMeta( 'validation_errors', $validation['errors'] );
				throw new \RuntimeException( 'Validation failed: ' . implode( ', ', array_values( $validation['errors'] ) ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
		}

		// Persist payload/meta snapshot. Sanitize user-submitted values before storing.
		$payload = $context->payload;
		// The entry references its schema by version (the schema_version
		// column) instead of keeping a full copy in its meta (FF-30).
		$meta    = \SubtleForms\Support\EntrySchema::stripCopy( $context->meta );

		if ( is_array( $schema ) ) {
			$payload = $this->sanitize_payload( $schema, $payload );
		} else {
			// Fallback: ensure scalar values are safely cast
			array_walk_recursive( $payload, function ( &$value ) {
				if ( is_string( $value ) ) {
					$value = sanitize_text_field( $value );
				}
			} );
		}

		$updated = $this->subsRepo->update(
			$submissionId,
			array(
				'payload' => $payload,
				'meta'    => $meta,
				'status'  => 'saved',
			)
		);

		if ( $updated === false ) {
			throw new \RuntimeException( 'Failed to persist submission payload in SaveAction.' );
		}

                // Capture save details for pipeline log enrichment.
                $context->setMeta(
                        'step_output_data',
                        array(
                                'submission_id' => $submissionId,
                                'field_count'   => count( $payload ),
                                'field_keys'    => array_keys( $payload ),
                                'status_written' => 'saved',
                        )
                );
        }

        /**
         * Sanitize submission payload based on schema field types.
	 *
	 * @param array $schema Form schema.
	 * @param array $payload Submission payload.
	 * @return array Sanitized payload.
	 */
	private function sanitize_payload( array $schema, array $payload ): array {
		$fields = $this->flatten_fields( $schema['fields'] ?? array() );

		$sanitized = array();

		foreach ( $payload as $key => $value ) {
			$field = $fields[ $key ] ?? null;

			// Task 3: Strip unknown field keys, not present in schema, prevents injection and data pollution
			if ( ! $field ) {
				continue;
			}

			$type   = $field['type'] ?? '';

			// Repeater: a list of groups, each cleaned with the children's rules.
			if ( $type === \SubtleForms\Support\Repeater::TYPE ) {
				$sanitized[ $key ] = \SubtleForms\Support\Repeater::clean(
					$field,
					$value,
					function ( array $childSchema, array $group ): array {
						return $this->sanitize_payload( $childSchema, $group );
					}
				);
				continue;
			}

			// Task 5: Normalize null, stored as null
			if ( is_null( $value ) ) {
				$sanitized[ $key ] = null;
				continue;
			}

			// Paragraph, rich text and password answers have their own rules
			// (2.2.1): keep line breaks, keep basic formatting, never store a
			// password as typed.
			if ( ! is_array( $value ) && in_array( $type, array( 'textarea', 'rich_text', 'password' ), true ) ) {
				$sanitized[ $key ] = \SubtleForms\Support\EntryValues::sanitizeScalar( $value, $field );
				continue;
			}
			if ( $type === 'password' ) {
				$sanitized[ $key ] = '';
				continue;
			}

			// Task 2: Normalize composite field payloads (name_group, address_group)
			if ( $type === 'name_group' || $type === 'address_group' ) {
				$sanitized[ $key ] = $this->normalize_composite_value( $value );
				continue;
			}

			if ( is_array( $value ) ) {
				// Task 5: Empty array stored as []
				if ( empty( $value ) ) {
					$sanitized[ $key ] = array();
					continue;
				}
				// Recursively sanitize non-empty arrays
				$sanitized[ $key ] = $this->sanitize_array_recursive( $value, $field );
				continue;
			}

			// Task 5: Empty string stored as ""
			if ( $value === '' ) {
				$sanitized[ $key ] = '';
				continue;
			}

			switch ( $type ) {
				case 'email':
					$sanitized[ $key ] = sanitize_email( sanitize_text_field( (string) $value ) );
					break;
				case 'url':
					$sanitized[ $key ] = esc_url_raw( sanitize_text_field( (string) $value ) );
					break;
				case 'number':
				case 'payment_amount':
					$sanitized[ $key ] = is_numeric( $value ) ? $value : 0;
					break;
				default:
					// Allow filtered HTML when field explicitly allows it
					if ( ! empty( $field['allow_html'] ) ) {
						$sanitized[ $key ] = wp_kses_post( (string) $value );
					} else {
						$sanitized[ $key ] = sanitize_text_field( (string) $value );
					}
					break;
			}
		}

		return $sanitized;
	}

	/**
	 * Recursively sanitize arrays of values.
	 *
	 * @param array $arr Array to sanitize.
	 * @param array|null $field Field definition or null.
	 * @return array
	 */
	private function sanitize_array_recursive( array $arr, $field = null ): array {
		$result = array();
		foreach ( $arr as $k => $v ) {
			if ( is_array( $v ) ) {
				$result[ $k ] = $this->sanitize_array_recursive( $v, $field );
				continue;
			}

			if ( is_string( $v ) ) {
				if ( $field && ! empty( $field['allow_html'] ) ) {
					$result[ $k ] = wp_kses_post( $v );
				} else {
					$result[ $k ] = sanitize_text_field( $v );
				}
			} else {
				$result[ $k ] = $v;
			}
		}
		return $result;
	}

	/**
	 * Flatten schema fields into map: key => field definition
	 *
	 * @param array $fields
	 * @param array $map
	 * @return array
	 */
	private function flatten_fields( array $fields, array &$map = array() ): array {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( ! empty( $field['key'] ) ) {
				$map[ $field['key'] ] = $field;
			}

			// Repeater children are answered inside the groups, never at the
			// top level of the entry.
			if ( ( $field['type'] ?? '' ) === \SubtleForms\Support\Repeater::TYPE ) {
				continue;
			}

			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$this->flatten_fields( $field['fields'], $map );
			}

			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$this->flatten_fields( $field['children'], $map );
			}

			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) ) {
						$this->flatten_fields( $column, $map );
					}
				}
			}
		}

		return $map;
	}

	/**
	 * Task 1: Normalize schema field nodes, ensure every field has id, type, label, config.
	 * Assigns safe defaults for missing keys. Does not throw.
	 *
	 * @param array $schema
	 * @return array
	 */
	private function normalize_schema_fields( array $schema ): array {
		if ( isset( $schema['fields'] ) && is_array( $schema['fields'] ) ) {
			$schema['fields'] = $this->normalize_field_list( $schema['fields'] );
		}
		return $schema;
	}

	/**
	 * Recursively normalize a list of field nodes.
	 *
	 * @param array $fields
	 * @return array
	 */
	private function normalize_field_list( array $fields ): array {
		foreach ( $fields as &$field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$field['id']    = $field['id'] ?? $field['key'] ?? '';
			$field['type']  = $field['type'] ?? '';
			$field['label'] = $field['label'] ?? '';

			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$field['fields'] = $this->normalize_field_list( $field['fields'] );
			}
			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$field['children'] = $this->normalize_field_list( $field['children'] );
			}
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as &$column ) {
					if ( is_array( $column ) ) {
						$column = $this->normalize_field_list( $column );
					}
				}
				unset( $column );
			}
		}
		unset( $field );
		return $fields;
	}

	/**
	 * Task 2: Normalize a composite field value (name_group, address_group).
	 * Ensures the value is always an array of sanitized string sub-values.
	 * Malformed input is normalized, submission is NOT rejected.
	 *
	 * @param mixed $value
	 * @return array
	 */
	private function normalize_composite_value( $value ): array {
		if ( ! is_array( $value ) ) {
			// Null, string, or other scalar, return empty composite
			return array();
		}
		$normalized = array();
		foreach ( $value as $sub_key => $sub_val ) {
			if ( ! is_string( $sub_key ) ) {
				continue;
			}
			$normalized[ $sub_key ] = is_string( $sub_val )
				? sanitize_text_field( $sub_val )
				: ( is_null( $sub_val ) ? null : sanitize_text_field( (string) $sub_val ) );
		}
		return $normalized;
	}
}

