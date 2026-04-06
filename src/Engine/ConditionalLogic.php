<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Evaluates conditional logic rules against submission data.
 *
 * Handles field-level and step-level visibility, requirement, and enablement conditions.
 */
final class ConditionalLogic {

	private const SUPPORTED_OPERATORS = array(
		'equals',
		'not_equals',
		'contains',
		'not_contains',
		'empty',
		'not_empty',
		'greater_than',
		'less_than',
		'in',
		'not_in',
	);

	/**
	 * Evaluate all conditions and return compiled state.
	 *
	 * @param array<string,mixed> $schema Full form schema
	 * @param array<string,mixed> $payload Submission data (field key => value)
	 * @return array{
	 *   hidden_fields: string[],
	 *   required_fields: string[],
	 *   disabled_fields: string[],
	 *   hidden_steps: string[]
	 * }
	 */
	public function evaluate( array $schema, array $payload ): array {
		$result = array(
			'hidden_fields'   => array(),
			'required_fields' => array(),
			'disabled_fields' => array(),
			'hidden_steps'    => array(),
		);

		// Extract conditions from field configs
		$fields = $schema['fields'] ?? array();
		$this->evaluateFieldConditions( $fields, $payload, $result );

		// Extract global logic rules
		$logic = $schema['logic'] ?? array();
		foreach ( $logic as $rule ) {
			$this->evaluateRule( $rule, $payload, $result );
		}

		return $result;
	}

	/**
	 * Recursively process field conditions.
	 */
	private function evaluateFieldConditions( array $fields, array $payload, array &$result ): void {
		foreach ( $fields as $field ) {
			$conditions = $field['config']['conditions'] ?? array();

			if ( ! empty( $conditions ) && is_array( $conditions ) ) {
				foreach ( $conditions as $condition ) {
					$this->evaluateFieldCondition( $condition, $field, $payload, $result );
				}
			}

			// Process nested fields (containers/steps)
			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$this->evaluateFieldConditions( $field['fields'], $payload, $result );
			}

			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$this->evaluateFieldConditions( $field['children'], $payload, $result );
			}

			// Process column containers
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) ) {
						$this->evaluateFieldConditions( $column, $payload, $result );
					}
				}
			}
		}
	}

	/**
	 * Evaluate a single field-level condition.
	 */
	private function evaluateFieldCondition( array $condition, array $field, array $payload, array &$result ): void {
		$sourceField = $condition['sourceField'] ?? null;
		$operator    = $condition['operator'] ?? 'equals';
		$value       = $condition['value'] ?? null;
		$effect      = $condition['effect'] ?? 'show';

		if ( empty( $sourceField ) ) {
			return;
		}

		$sourceValue = $payload[ $sourceField ] ?? null;
		$matches     = $this->evaluateCondition( $sourceValue, $operator, $value );

		// Apply effect
		$fieldKey  = $field['key'] ?? null;
		$fieldType = $field['type'] ?? null;

		if ( empty( $fieldKey ) ) {
			return;
		}

		// For steps, track step-specific hiding
		if ( $fieldType === 'step' ) {
			if ( $effect === 'hide' && $matches ) {
				$result['hidden_steps'][] = $fieldKey;
			} elseif ( $effect === 'show' && ! $matches ) {
				$result['hidden_steps'][] = $fieldKey;
			}
			return;
		}

		// For regular fields
		switch ( $effect ) {
			case 'show':
				if ( ! $matches ) {
					$result['hidden_fields'][] = $fieldKey;
				}
				break;
			case 'hide':
				if ( $matches ) {
					$result['hidden_fields'][] = $fieldKey;
				}
				break;
			case 'require':
				if ( $matches ) {
					$result['required_fields'][] = $fieldKey;
				}
				break;
			case 'disable':
				if ( $matches ) {
					$result['disabled_fields'][] = $fieldKey;
				}
				break;
		}
	}

	/**
	 * Evaluate a global logic rule.
	 */
	private function evaluateRule( array $rule, array $payload, array &$result ): void {
		$condition = $rule['if'] ?? null;
		$action    = $rule['then'] ?? null;

		if ( ! is_array( $condition ) || ! is_array( $action ) ) {
			return;
		}

		$field    = $condition['field'] ?? null;
		$operator = $condition['operator'] ?? 'equals';
		$value    = $condition['value'] ?? null;

		if ( empty( $field ) ) {
			return;
		}

		$fieldValue = $payload[ $field ] ?? null;
		$matches    = $this->evaluateCondition( $fieldValue, $operator, $value );

		if ( ! $matches ) {
			return;
		}

		// Apply action
		$actionType = $action['action'] ?? null;
		$target     = $action['target'] ?? null;

		if ( empty( $actionType ) || empty( $target ) ) {
			return;
		}

		switch ( $actionType ) {
			case 'show':
				// Remove from hidden if present
				$result['hidden_fields'] = array_diff( $result['hidden_fields'], array( $target ) );
				break;
			case 'hide':
				if ( ! in_array( $target, $result['hidden_fields'], true ) ) {
					$result['hidden_fields'][] = $target;
				}
				break;
			case 'require':
				if ( ! in_array( $target, $result['required_fields'], true ) ) {
					$result['required_fields'][] = $target;
				}
				break;
			case 'disable':
				if ( ! in_array( $target, $result['disabled_fields'], true ) ) {
					$result['disabled_fields'][] = $target;
				}
				break;
		}
	}

	/**
	 * @param mixed  $fieldValue
	 * @param string $operator
	 * @param mixed  $compareValue
	 * @return bool
	 */
	private function evaluateCondition( $fieldValue, $operator, $compareValue ) {
		switch ( $operator ) {
			case 'equals':
				return $this->compareEquals( $fieldValue, $compareValue );
			case 'not_equals':
				return ! $this->compareEquals( $fieldValue, $compareValue );
			case 'contains':
				return $this->compareContains( $fieldValue, $compareValue );
			case 'not_contains':
				return ! $this->compareContains( $fieldValue, $compareValue );
			case 'empty':
				return $this->isEmpty( $fieldValue );
			case 'not_empty':
				return ! $this->isEmpty( $fieldValue );
			case 'greater_than':
				return $this->compareNumeric( $fieldValue, $compareValue, '>' );
			case 'less_than':
				return $this->compareNumeric( $fieldValue, $compareValue, '<' );
			case 'in':
				return $this->compareIn( $fieldValue, $compareValue );
			case 'not_in':
				return ! $this->compareIn( $fieldValue, $compareValue );
			default:
				return false;
		}
	}

	/**
	 * @param mixed $a
	 * @param mixed $b
	 * @return bool
	 */
	private function compareEquals( $a, $b ) {
		// Type-safe comparison
		if ( is_array( $a ) && is_array( $b ) ) {
			return $a === $b;
		}

		return (string) $a === (string) $b;
	}

	/**
	 * @param mixed $haystack
	 * @param mixed $needle
	 * @return bool
	 */
	private function compareContains( $haystack, $needle ) {
		if ( is_array( $haystack ) ) {
			return in_array( $needle, $haystack, true );
		}

		if ( ! is_string( $haystack ) || ! is_scalar( $needle ) ) {
			return false;
		}

		return str_contains( $haystack, (string) $needle );
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
	 * @param mixed  $a
	 * @param mixed  $b
	 * @param string $op
	 * @return bool
	 */
	private function compareNumeric( $a, $b, $op ) {
		if ( ! is_numeric( $a ) || ! is_numeric( $b ) ) {
			return false;
		}

		$numA = (float) $a;
		$numB = (float) $b;

		switch ( $op ) {
			case '>':
				return $numA > $numB;
			case '<':
				return $numA < $numB;
			case '>=':
				return $numA >= $numB;
			case '<=':
				return $numA <= $numB;
			default:
				return false;
		}
	}

	/**
	 * @param mixed $needle
	 * @param mixed $haystack
	 * @return bool
	 */
	private function compareIn( $needle, $haystack ) {
		if ( ! is_array( $haystack ) ) {
			return false;
		}

		return in_array( $needle, $haystack, true );
	}
}
