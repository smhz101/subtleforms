<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

use SubtleForms\Engine\ActionRegistry as AR;
use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Support\Logger;
use InvalidArgumentException;

/**
 * Compile a validated form schema into PipelineStep instances.
 */
final class SchemaCompiler {

	/**
	 * @var AR
	 */
	private $registry;

	/**
	 * @var ConditionalLogic
	 */
	private $conditionalLogic;

	public function __construct( AR $registry, ?ConditionalLogic $conditionalLogic = null ) {
		$this->registry         = $registry;
		$this->conditionalLogic = $conditionalLogic ?? new ConditionalLogic();
	}

	/**
	 * @param array<string,mixed> $schema The validated schema array
	 * @return PipelineStepInterface[]
	 */
	public function compile( array $schema ): array {
		$steps = array();

		$actions = $schema['actions'] ?? array();
		if ( ! is_array( $actions ) ) {
			throw new InvalidArgumentException( 'Schema.actions must be an array' );
		}

		// CRITICAL: Ensure SaveAction always exists as first action
		// If no 'save' action exists in schema, inject one automatically
		$hasSaveAction = false;
		foreach ( $actions as $act ) {
			if ( is_array( $act ) && isset( $act['type'] ) && $act['type'] === 'save' ) {
				$hasSaveAction = true;
				break;
			}
		}

		if ( ! $hasSaveAction ) {
			// Inject SaveAction as first action
			array_unshift(
				$actions,
				array(
					'type'     => 'save',
					'settings' => array(),
				)
			);
		} else {
			// Ensure SaveAction runs first if present: move first 'save' action to index 0.
			foreach ( $actions as $idx => $a ) {
				if ( is_array( $a ) && isset( $a['type'] ) && $a['type'] === 'save' ) {
					if ( $idx !== 0 ) {
						array_splice( $actions, $idx, 1 );
						array_unshift( $actions, $a );
					}
					break;
				}
			}
		}

		foreach ( $actions as $i => $act ) {
			if ( ! is_array( $act ) || empty( $act['type'] ) || ! is_string( $act['type'] ) ) {
				throw new InvalidArgumentException( "Action at index {$i} must be an object with string 'type'." );
			}

			$type = $act['type'];

			// Resolve definition first — soft-skip unknown types so that Pro
			// deactivation or schema migration gaps don't break live submissions.
			$def = $this->registry->getDefinition( $type );
			if ( $def === null ) {
				Logger::warning(
					"SchemaCompiler: Unknown action type '%s' at index %d — skipping. Activate the required plugin or remove this action from the schema.",
					$type,
					$i
				);
				continue;
			}

			// Resolve implementation — same soft-skip if definition exists but class is missing.
			$actionImpl = $this->registry->getImplementation( $type );
			if ( $actionImpl === null ) {
				Logger::warning(
					"SchemaCompiler: No implementation for action type '%s' at index %d — skipping.",
					$type,
					$i
				);
				continue;
			}

			// Deterministic step id: action:type:index
			$stepId = sprintf( 'action:%s:%d', $type, $i );

			// Capabilities required: combine definition-level and instance-level requires
			$defCaps      = $def->requiredCapabilities();
			$instanceCaps = array();
			if ( isset( $act['requires'] ) && is_array( $act['requires'] ) ) {
				$instanceCaps = array_values( array_filter( $act['requires'], fn( $v ) => is_string( $v ) ) );
			}
			$requires = array_values( array_unique( array_merge( $defCaps, $instanceCaps ) ) );

			$skippable = isset( $act['skippable'] ) ? (bool) $act['skippable'] : false;

			$settings = isset( $act['settings'] ) && is_array( $act['settings'] ) ? $act['settings'] : array();

			// Note: actionImpl acts as a prototype; pass instance settings to the step.
			$steps[] = new PipelineStep( $stepId, $actionImpl, $requires, $skippable, $settings );
		}

		return $steps;
	}

	/**
	 * Evaluate conditional logic and attach metadata to submission context.
	 *
	 * @param array<string,mixed> $schema
	 * @param SubmissionContext   $ctx
	 */
	public function evaluateConditions( array $schema, SubmissionContext $ctx ): void {
		$conditionalState = $this->conditionalLogic->evaluate( $schema, $ctx->payload );

		$ctx->setMeta( 'conditional_state', $conditionalState );
		$ctx->setMeta( 'hidden_fields', $conditionalState['hidden_fields'] );
		$ctx->setMeta( 'required_fields', $conditionalState['required_fields'] );
		$ctx->setMeta( 'disabled_fields', $conditionalState['disabled_fields'] );
		$ctx->setMeta( 'hidden_steps', $conditionalState['hidden_steps'] );
	}

	/**
	 * Normalize schema field nodes to ensure each has the required keys:
	 * id, type, label. Safe defaults are assigned for missing keys.
	 *
	 * @param array $schema
	 * @return array Normalized schema
	 */
	public function normalizeSchema( array $schema ): array {
		if ( isset( $schema['fields'] ) && is_array( $schema['fields'] ) ) {
			$schema['fields'] = $this->normalizeFieldList( $schema['fields'] );
		}
		return $schema;
	}

	/**
	 * Recursively normalize a list of field nodes.
	 *
	 * @param array $fields
	 * @return array
	 */
	private function normalizeFieldList( array $fields ): array {
		foreach ( $fields as &$field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			// Ensure every field has id, type, label
			$field['id']    = $field['id'] ?? $field['key'] ?? '';
			$field['type']  = $field['type'] ?? '';
			$field['label'] = $field['label'] ?? '';

			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$field['fields'] = $this->normalizeFieldList( $field['fields'] );
			}
			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$field['children'] = $this->normalizeFieldList( $field['children'] );
			}
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as &$column ) {
					if ( is_array( $column ) ) {
						$column = $this->normalizeFieldList( $column );
					}
				}
				unset( $column );
			}
		}
		unset( $field );
		return $fields;
	}
}
