<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

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
			$conditionalState = $context->getMeta(
				'conditional_state',
				array(
					'hidden_fields'   => array(),
					'required_fields' => array(),
					'disabled_fields' => array(),
					'hidden_steps'    => array(),
				)
			);

			$validation = $this->validator->validate( $schema, $context->payload, $conditionalState );

			if ( ! $validation['valid'] ) {
				$context->setMeta( 'validation_errors', $validation['errors'] );
				throw new \RuntimeException( 'Validation failed: ' . implode( ', ', array_values( $validation['errors'] ) ) );
			}
		}

		// Persist payload/meta snapshot. Sanitize user-submitted values before storing.
		$payload = $context->payload;
		$meta    = $context->meta;

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

			if ( is_array( $value ) ) {
				// Recursively sanitize arrays
				$sanitized[ $key ] = $this->sanitize_array_recursive( $value, $field );
				continue;
			}

			if ( $field ) {
				$type   = $field['type'] ?? '';
				$config = $field['config'] ?? array();

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
						if ( ! empty( $config['allow_html'] ) ) {
							$sanitized[ $key ] = wp_kses_post( (string) $value );
						} else {
							$sanitized[ $key ] = sanitize_text_field( (string) $value );
						}
						break;
				}
			} else {
				// Unknown field - sanitize conservatively
				$sanitized[ $key ] = is_string( $value ) ? sanitize_text_field( $value ) : $value;
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
				if ( $field && ! empty( $field['config']['allow_html'] ) ) {
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
			if ( ! empty( $field['key'] ) ) {
				$map[ $field['key'] ] = $field;
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
}

