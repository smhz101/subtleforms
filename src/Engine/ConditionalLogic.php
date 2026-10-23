<?php

declare(strict_types=1);

namespace SubtleForms\Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Evaluates conditional logic against submission data.
 *
 * This is the server half of one specification; resources/shared/conditions.js
 * is the browser half. Both are tested against tests/fixtures/conditional-logic.json
 * so a form hides, requires and routes the same way in the browser and on submit.
 *
 * Logic object (on a field, step, action or confirmation, as `logic`):
 *
 *     array(
 *         'action' => 'show' | 'hide' | 'require' | 'disable',
 *         'groups' => array(
 *             array( 'match' => 'all' | 'any', 'rules' => array( array( 'field', 'operator', 'value', 'value2' ) ) ),
 *         ),
 *     )
 *
 * This plugin evaluates the basic form of logic on fields: one group whose
 * rules must all match, with the basic operators. Everything beyond that is
 * left to an add-on (SubtleForms Pro): several groups (OR), the "any" match,
 * the other operators, and conditions on steps, actions and confirmations.
 * Logic this plugin does not evaluate and no add-on claims through
 * `subtleforms/logic/supports` is ignored, as if the field had no rule: it is
 * stored untouched, never rejected, and never changes what a visitor sees.
 *
 * The older `conditions` list ({ sourceField, operator, value, effect }) is
 * still read: rules that share an effect form one "all" group.
 */
final class ConditionalLogic {

	/** Operators this plugin evaluates. */
	public const BASIC_OPERATORS = array(
		'equals',
		'not_equals',
		'contains',
		'not_contains',
		'empty',
		'not_empty',
		'greater_than',
		'less_than',
	);

	private const NUMERIC_RE = '/^\s*[-+]?(\d+(\.\d*)?|\.\d+)\s*$/';
	private const MAX_PASSES = 5;

	/** @var string|null Day used for "today" (YYYY-MM-DD); null = site's today. */
	private $today;

	public function __construct( ?string $today = null ) {
		$this->today = $today;
	}

	/**
	 * Evaluate all conditions and return the compiled state.
	 *
	 * Hidden answers do not count: the form is re-evaluated without them until
	 * nothing changes (at most five passes).
	 *
	 * @param array<string,mixed> $schema  Full form schema.
	 * @param array<string,mixed> $payload Submission data (field key => value).
	 * @return array{hidden_fields: string[], required_fields: string[], disabled_fields: string[], hidden_steps: string[]}
	 */
	public function evaluate( array $schema, array $payload ): array {
		$fields   = isset( $schema['fields'] ) && is_array( $schema['fields'] ) ? $schema['fields'] : array();
		$current  = $payload;
		$state    = null;
		$previous = null;

		for ( $pass = 0; $pass < self::MAX_PASSES; $pass++ ) {
			$state = $this->evaluateOnce( $fields, $current );
			$this->applyGlobalRules( $schema['logic'] ?? null, $current, $state );

			$hidden = $state['hidden'];
			$steps  = $state['hiddenSteps'];
			sort( $hidden );
			sort( $steps );
			$signature = implode( '|', $hidden ) . '#' . implode( '|', $steps );
			if ( $signature === $previous ) {
				break;
			}
			$previous = $signature;
			$current  = self::withoutKeys( $payload, $state['hidden'] );
		}

		return array(
			'hidden_fields'   => array_values( $state['hidden'] ),
			'required_fields' => array_values( array_diff( $state['required'], $state['hidden'] ) ),
			'disabled_fields' => array_values( $state['disabled'] ),
			'hidden_steps'    => array_values( $state['hiddenSteps'] ),
		);
	}

	/**
	 * The payload without answers to hidden fields: what gets stored.
	 *
	 * @param array<string,mixed> $schema
	 * @param array<string,mixed> $payload
	 * @return array<string,mixed>
	 */
	public function visiblePayload( array $schema, array $payload, ?array $logicValues = null ): array {
		// Rules read $logicValues when given (the answers as typed), and the
		// fields they hide are removed from $payload.
		$state = $this->evaluate( $schema, $logicValues ?? $payload );
		return self::withoutKeys( $payload, $state['hidden_fields'] );
	}

	/**
	 * Whether a logic object's conditions are met. Inactive logic passes, and
	 * so does logic nobody evaluates (see the class notes): it is ignored.
	 *
	 * @param mixed               $logic
	 * @param array<string,mixed> $values
	 * @param array<string,array> $fields_by_key Fields by key, for field specific matching.
	 * @param string              $scope          field, step, action or confirmation.
	 */
	public function logicPasses( $logic, array $values, array $fields_by_key = array(), string $scope = 'field' ): bool {
		$l = self::normalizeLogic( $logic );
		if ( $l === null ) {
			return true;
		}
		if ( ! self::isBasic( $l, $scope ) ) {
			/**
			 * Whether advanced logic passes. An add-on that returned true from
			 * `subtleforms/logic/supports` evaluates it here: several groups,
			 * the "any" match, other operators, and logic on steps, actions and
			 * confirmations. Return true or false, or null to leave it ignored.
			 *
			 * @param bool|null           $result        Null.
			 * @param array               $logic         Normalised logic: action and groups of match and rules.
			 * @param array<string,mixed> $values        Answers by field key.
			 * @param array<string,array> $fields_by_key Fields by key.
			 * @param string              $scope         field, step, action or confirmation.
			 * @param ConditionalLogic    $engine        The evaluator, for its helpers.
			 * @since 2.7.0
			 */
			$result = apply_filters( 'subtleforms/logic/passes', null, $l, $values, $fields_by_key, $scope, $this );
			return null === $result ? true : (bool) $result;
		}
		foreach ( $l['groups'][0]['rules'] as $rule ) {
			$field = $fields_by_key[ $rule['field'] ] ?? null;
			if ( ! $this->evaluateCondition( self::readValue( $values, $rule['field'] ), $rule['operator'], $rule['value'], $rule['value2'], is_array( $field ) ? $field : null ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Whether a logic object has at least one rule that is evaluated: a
	 * basic rule on a field, or logic an add-on evaluates. Logic nobody
	 * evaluates counts as none.
	 *
	 * @param mixed  $logic
	 * @param string $scope field, step, action or confirmation.
	 */
	public static function hasLogic( $logic, string $scope = 'field' ): bool {
		$l = self::normalizeLogic( $logic );
		return $l !== null && self::isSupported( $l, $scope );
	}

	/**
	 * Whether normalised logic is the basic form this plugin evaluates itself:
	 * on a field, one group whose rules must all match, with basic operators.
	 *
	 * @param array  $l     Normalised logic.
	 * @param string $scope field, step, action or confirmation.
	 */
	public static function isBasic( array $l, string $scope = 'field' ): bool {
		if ( 'field' !== $scope || count( $l['groups'] ) !== 1 || $l['groups'][0]['match'] !== 'all' ) {
			return false;
		}
		foreach ( $l['groups'][0]['rules'] as $rule ) {
			if ( ! in_array( $rule['operator'], self::BASIC_OPERATORS, true ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Whether this site evaluates a normalised logic object.
	 *
	 * @param array  $l     Normalised logic.
	 * @param string $scope field, step, action or confirmation.
	 */
	public static function isSupported( array $l, string $scope = 'field' ): bool {
		if ( self::isBasic( $l, $scope ) ) {
			return true;
		}
		/**
		 * Whether an add-on evaluates this logic. Return true to take it on
		 * (and evaluate it with `subtleforms/logic/passes`). Logic that no one
		 * takes on is ignored: the field is shown, the step, email or webhook
		 * runs, and the default confirmation is used.
		 *
		 * @param bool   $supported Default false.
		 * @param array  $logic     Normalised logic: action and groups of match and rules.
		 * @param string $scope     field, step, action or confirmation.
		 * @since 2.7.0
		 */
		return (bool) apply_filters( 'subtleforms/logic/supports', false, $l, $scope );
	}

	/**
	 * The confirmation to show: the first conditional confirmation whose
	 * conditions pass, else the form's default confirmation.
	 *
	 * @param mixed               $metadata Form metadata.
	 * @param array<string,mixed> $values   Visible answers.
	 * @return array<string,mixed>
	 */
	public function pickConfirmation( $metadata, array $values ): array {
		$meta = is_array( $metadata ) ? $metadata : array();
		$list = isset( $meta['confirmations'] ) && is_array( $meta['confirmations'] ) ? $meta['confirmations'] : array();
		foreach ( $list as $c ) {
			if ( ! is_array( $c ) || ( array_key_exists( 'enabled', $c ) && $c['enabled'] === false ) ) {
				continue;
			}
			if ( self::hasLogic( $c['logic'] ?? null, 'confirmation' ) && $this->logicPasses( $c['logic'], $values, array(), 'confirmation' ) ) {
				return $c;
			}
		}
		return isset( $meta['confirmation'] ) && is_array( $meta['confirmation'] ) ? $meta['confirmation'] : array();
	}

	/**
	 * Whether one answer satisfies one operator.
	 *
	 * @param mixed  $value    The answer.
	 * @param string $operator Operator key.
	 * @param mixed  $compare  The rule's value.
	 * @param mixed  $compare2 Upper bound for "between".
	 */
	public function evaluateCondition( $value, string $operator, $compare, $compare2 = '', $field = null ): bool {
		$items = self::listOf( $value );
		$c     = self::toText( $compare );

		switch ( $operator ) {
			case 'equals':
				return self::matches( $value, $items, $c, $field );
			case 'not_equals':
				return ! self::matches( $value, $items, $c, $field );
			case 'contains':
			case 'not_contains':
				$needle = self::norm( $c );
				$found  = false;
				if ( $needle !== '' ) {
					if ( self::isList( $value ) ) {
						foreach ( $items as $x ) {
							if ( self::norm( $x ) === $needle ) {
								$found = true;
								break;
							}
						}
					} else {
						$found = strpos( self::norm( self::toText( $value ) ), $needle ) !== false;
					}
				}
				return $operator === 'contains' ? $found : ! $found;
			case 'empty':
				return self::isEmptyForField( $value, $field );
			case 'not_empty':
				return ! self::isEmptyForField( $value, $field );
			case 'greater_than':
			case 'less_than':
				if ( ! self::isNumeric( $c ) ) {
					return false;
				}
				foreach ( $items as $x ) {
					if ( ! self::isNumeric( $x ) ) {
						continue;
					}
					if ( $operator === 'greater_than' ? (float) $x > (float) $c : (float) $x < (float) $c ) {
						return true;
					}
				}
				return false;
			default:
				/**
				 * Evaluate an operator this plugin does not know (an add-on's
				 * operator). Return true or false, or null for an unknown one,
				 * which does not match.
				 *
				 * @param bool|null        $result   Null.
				 * @param mixed            $value    The answer.
				 * @param string           $operator Operator key.
				 * @param mixed            $compare  The rule's value.
				 * @param mixed            $compare2 Upper bound for "between".
				 * @param array|null       $field    The field the rule reads.
				 * @param ConditionalLogic $engine   The evaluator, for its helpers.
				 * @since 2.7.0
				 */
				$result = apply_filters( 'subtleforms/logic/evaluate_condition', null, $value, $operator, $compare, $compare2, $field, $this );
				return null === $result ? false : (bool) $result;
		}
	}

	// ── Normalisation ───────────────────────────────────────────────────

	/**
	 * Normalise a logic object: drop empty rules and groups.
	 *
	 * @param mixed $logic
	 * @return array{action:string, groups:array}|null Null when there is nothing to evaluate.
	 */
	public static function normalizeLogic( $logic ): ?array {
		if ( ! is_array( $logic ) || self::isList( $logic ) ) {
			return null;
		}
		$groups = null;
		if ( isset( $logic['groups'] ) && is_array( $logic['groups'] ) ) {
			$groups = $logic['groups'];
		} elseif ( isset( $logic['rules'] ) && is_array( $logic['rules'] ) ) {
			$groups = array(
				array(
					'match' => $logic['match'] ?? 'all',
					'rules' => $logic['rules'],
				),
			);
		}
		if ( $groups === null ) {
			return null;
		}

		$clean = array();
		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || ! isset( $group['rules'] ) || ! is_array( $group['rules'] ) ) {
				continue;
			}
			$rules = array();
			foreach ( $group['rules'] as $rule ) {
				$r = self::normalizeRule( $rule );
				if ( $r !== null ) {
					$rules[] = $r;
				}
			}
			if ( $rules ) {
				$clean[] = array(
					'match' => ( $group['match'] ?? 'all' ) === 'any' ? 'any' : 'all',
					'rules' => $rules,
				);
			}
		}
		if ( ! $clean ) {
			return null;
		}

		$action = isset( $logic['action'] ) && in_array( $logic['action'], array( 'show', 'hide', 'require', 'disable' ), true )
			? $logic['action']
			: 'show';

		return array(
			'action' => $action,
			'groups' => $clean,
		);
	}

	/**
	 * @param mixed $rule
	 * @return array{field:string, operator:string, value:mixed, value2:mixed}|null
	 */
	private static function normalizeRule( $rule ): ?array {
		if ( ! is_array( $rule ) || self::isList( $rule ) ) {
			return null;
		}
		$field = $rule['field'] ?? $rule['sourceField'] ?? '';
		if ( ! is_string( $field ) || $field === '' ) {
			return null;
		}
		return array(
			'field'    => $field,
			'operator' => isset( $rule['operator'] ) && is_string( $rule['operator'] ) && $rule['operator'] !== '' ? $rule['operator'] : 'equals',
			'value'    => $rule['value'] ?? '',
			'value2'   => $rule['value2'] ?? '',
		);
	}

	/**
	 * All logic objects on a node: `logic` first, else legacy `conditions`.
	 *
	 * @param array<string,mixed> $node
	 * @return array<int,array>
	 */
	public static function nodeLogics( array $node ): array {
		$scope = ( $node['type'] ?? '' ) === 'step' ? 'step' : 'field';
		return array_values(
			array_filter(
				self::allNodeLogics( $node ),
				static fn( array $l ): bool => self::isSupported( $l, $scope )
			)
		);
	}

	/**
	 * Every logic object on a node, evaluated or not.
	 *
	 * @param array<string,mixed> $node
	 * @return array<int,array>
	 */
	private static function allNodeLogics( array $node ): array {
		$cfg   = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$logic = $node['logic'] ?? $cfg['logic'] ?? null;
		$one   = self::normalizeLogic( $logic );
		if ( $one !== null ) {
			return array( $one );
		}

		$legacy = $node['conditions'] ?? $cfg['conditions'] ?? null;
		if ( ! is_array( $legacy ) || ! $legacy ) {
			return array();
		}
		$byEffect = array();
		foreach ( $legacy as $c ) {
			if ( ! is_array( $c ) || self::isList( $c ) ) {
				continue;
			}
			$effect = isset( $c['effect'] ) && is_string( $c['effect'] ) && $c['effect'] !== '' ? $c['effect'] : 'show';
			if ( ! isset( $byEffect[ $effect ] ) ) {
				$byEffect[ $effect ] = array(
					'action' => $effect,
					'groups' => array(
						array(
							'match' => 'all',
							'rules' => array(),
						),
					),
				);
			}
			$byEffect[ $effect ]['groups'][0]['rules'][] = $c;
		}
		$out = array();
		foreach ( $byEffect as $l ) {
			$n = self::normalizeLogic( $l );
			if ( $n !== null ) {
				$out[] = $n;
			}
		}
		return $out;
	}

	// ── Tree walk ───────────────────────────────────────────────────────

	/**
	 * @param array<int,mixed>    $fields
	 * @param array<string,mixed> $values
	 * @return array{hidden:string[], required:string[], disabled:string[], hiddenSteps:string[]}
	 */
	private function evaluateOnce( array $fields, array $values ): array {
		$state = array(
			'hidden'      => array(),
			'required'    => array(),
			'disabled'    => array(),
			'hiddenSteps' => array(),
		);
		$indexed = array();
		$this->indexFields( $fields, $indexed );
		$this->walk( $fields, $values, false, $state, '', $indexed );
		return $state;
	}

	/**
	 * @param array<int,mixed>    $nodes
	 * @param array<string,mixed> $values
	 * @param bool                $parentHidden
	 * @param array               $state
	 */
	private function walk( array $nodes, array $values, bool $parentHidden, array &$state, string $prefix = '', array $fields_by_key = array() ): void {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) || self::isList( $node ) ) {
				continue;
			}
			$rawKey = self::nodeKey( $node );
			$key    = ( null !== $rawKey && '' !== $prefix ) ? $prefix . $rawKey : $rawKey;
			$hidden = $parentHidden;

			$scope = ( $node['type'] ?? '' ) === 'step' ? 'step' : 'field';
			foreach ( self::nodeLogics( $node ) as $l ) {
				$passes = $this->logicPasses( $l, $values, $fields_by_key, $scope );
				if ( ( $l['action'] === 'show' && ! $passes ) || ( $l['action'] === 'hide' && $passes ) ) {
					$hidden = true;
				} elseif ( $l['action'] === 'require' && $passes ) {
					self::addTo( $state['required'], $key );
				} elseif ( $l['action'] === 'disable' && $passes ) {
					self::addTo( $state['disabled'], $key );
				}
			}

			if ( $hidden ) {
				if ( ( $node['type'] ?? '' ) === 'step' ) {
					self::addTo( $state['hiddenSteps'], $key );
				} else {
					self::addTo( $state['hidden'], $key );
				}
			}

			// Repeater (2.3.1): each group's children are evaluated with that
			// group's answers first, and reported as `items.0.qty`.
			if ( ( $node['type'] ?? '' ) === 'repeat_container' && null !== $rawKey ) {
				foreach ( self::repeaterGroups( self::readValue( $values, $rawKey ) ) as $index => $group ) {
					foreach ( self::childLists( $node ) as $list ) {
						$this->walk( $list, array_merge( $values, $group ), $hidden, $state, $key . '.' . $index . '.', $fields_by_key );
					}
				}
				continue;
			}

			foreach ( self::childLists( $node ) as $list ) {
				$this->walk( $list, $values, $hidden, $state, $prefix, $fields_by_key );
			}
		}
	}

	/**
	 * The groups of a Repeater answer (at least one).
	 *
	 * @param mixed $value List of groups, or an indexed map from a form post.
	 * @return array<int,array<string,mixed>>
	 */
	public static function repeaterGroups( $value ): array {
		$groups = array();
		if ( is_array( $value ) ) {
			$keys = array_keys( $value );
			$keys = array_values( array_filter( $keys, static function ( $k ) {
				return is_int( $k ) || ( is_string( $k ) && ctype_digit( $k ) );
			} ) );
			sort( $keys, SORT_NUMERIC );
			foreach ( $keys as $k ) {
				$groups[] = is_array( $value[ $k ] ) ? $value[ $k ] : array();
			}
		}
		return $groups ? $groups : array( array() );
	}

	/**
	 * Legacy schema-level rules: { if: { field, operator, value }, then: { action, target } }.
	 *
	 * @param mixed               $rules
	 * @param array<string,mixed> $values
	 * @param array               $state
	 */
	private function applyGlobalRules( $rules, array $values, array &$state ): void {
		if ( ! is_array( $rules ) ) {
			return;
		}
		foreach ( $rules as $rule ) {
			if ( ! is_array( $rule ) || ! isset( $rule['if'], $rule['then'] ) || ! is_array( $rule['if'] ) || ! is_array( $rule['then'] ) ) {
				continue;
			}
			$field  = $rule['if']['field'] ?? null;
			$target = $rule['then']['target'] ?? null;
			if ( empty( $field ) || empty( $target ) || ! is_string( $field ) || ! is_string( $target ) ) {
				continue;
			}
			$ok = $this->evaluateCondition(
				self::readValue( $values, $field ),
				(string) ( $rule['if']['operator'] ?? 'equals' ),
				$rule['if']['value'] ?? '',
				$rule['if']['value2'] ?? ''
			);
			if ( ! $ok ) {
				continue;
			}
			switch ( $rule['then']['action'] ?? '' ) {
				case 'show':
					$state['hidden'] = array_values( array_diff( $state['hidden'], array( $target ) ) );
					break;
				case 'hide':
					self::addTo( $state['hidden'], $target );
					break;
				case 'require':
					self::addTo( $state['required'], $target );
					break;
				case 'disable':
					self::addTo( $state['disabled'], $target );
					break;
			}
		}
	}

	/**
	 * @param array<string,mixed> $node
	 */
	private static function nodeKey( array $node ): ?string {
		$cfg = isset( $node['config'] ) && is_array( $node['config'] ) ? $node['config'] : array();
		$key = $node['key'] ?? $cfg['key'] ?? ( ( $node['type'] ?? '' ) === 'step' ? ( $node['id'] ?? null ) : null );
		return is_string( $key ) && $key !== '' ? $key : null;
	}

	/**
	 * @param array<string,mixed> $node
	 * @return array<int,array>
	 */
	private static function childLists( array $node ): array {
		$lists = array();
		if ( isset( $node['children'] ) && is_array( $node['children'] ) ) {
			$lists[] = $node['children'];
		}
		if ( isset( $node['fields'] ) && is_array( $node['fields'] ) ) {
			$lists[] = $node['fields'];
		}
		if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
			foreach ( $node['columns'] as $col ) {
				if ( ! is_array( $col ) ) {
					continue;
				}
				if ( self::isList( $col ) ) {
					$lists[] = $col;
					continue;
				}
				if ( isset( $col['fields'] ) && is_array( $col['fields'] ) ) {
					$lists[] = $col['fields'];
				}
				if ( isset( $col['children'] ) && is_array( $col['children'] ) ) {
					$lists[] = $col['children'];
				}
			}
		}
		return $lists;
	}

	// ── Value helpers (mirror conditions.js) ────────────────────────────

	/**
	 * @param string[] $list
	 */
	private static function addTo( array &$list, ?string $key ): void {
		if ( $key !== null && $key !== '' && ! in_array( $key, $list, true ) ) {
			$list[] = $key;
		}
	}

	/**
	 * @param array<string,mixed> $values
	 * @param string[]            $keys
	 * @return array<string,mixed>
	 */
	private static function withoutKeys( array $values, array $keys ): array {
		foreach ( $keys as $k ) {
			if ( array_key_exists( $k, $values ) || false === strpos( (string) $k, '.' ) ) {
				unset( $values[ $k ] );
				continue;
			}
			$values = self::withoutPath( $values, explode( '.', (string) $k ) );
		}
		return $values;
	}

	/**
	 * Remove a nested answer such as `items.1.qty`.
	 *
	 * @param array<string|int,mixed> $values
	 * @param string[]                $parts
	 * @return array<string|int,mixed>
	 */
	private static function withoutPath( array $values, array $parts ): array {
		$head = array_shift( $parts );
		if ( null === $head || ! array_key_exists( $head, $values ) ) {
			return $values;
		}
		if ( ! $parts ) {
			unset( $values[ $head ] );
			return $values;
		}
		if ( is_array( $values[ $head ] ) ) {
			$values[ $head ] = self::withoutPath( $values[ $head ], $parts );
		}
		return $values;
	}

	/**
	 * @param array<string,mixed> $values
	 * @return mixed
	 */
	public static function readValue( array $values, string $key ) {
		if ( $key === '' ) {
			return null;
		}
		if ( array_key_exists( $key, $values ) ) {
			return $values[ $key ];
		}
		$cur = $values;
		foreach ( explode( '.', $key ) as $part ) {
			if ( ! is_array( $cur ) || ! array_key_exists( $part, $cur ) ) {
				return null;
			}
			$cur = $cur[ $part ];
		}
		return $cur;
	}

	/**
	 * @param mixed $value
	 */
	public static function isList( $value ): bool {
		if ( ! is_array( $value ) ) {
			return false;
		}
		$i = 0;
		foreach ( $value as $k => $unused ) {
			if ( $k !== $i++ ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Scalar or composite value as text. Booleans become "true"/"false".
	 *
	 * @param mixed $value
	 */
	public static function toText( $value ): string {
		if ( $value === null ) {
			return '';
		}
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( is_int( $value ) ) {
			return (string) $value;
		}
		if ( is_float( $value ) ) {
			if ( ! is_finite( $value ) ) {
				return '';
			}
			if ( floor( $value ) === $value && abs( $value ) < 1e15 ) {
				return (string) (int) $value;
			}
			return (string) json_encode( $value );
		}
		if ( is_string( $value ) ) {
			return $value;
		}
		if ( is_array( $value ) ) {
			$parts = array();
			foreach ( $value as $v ) {
				$t = self::toText( $v );
				if ( trim( $t ) !== '' ) {
					$parts[] = $t;
				}
			}
			return implode( self::isList( $value ) ? ', ' : ' ', $parts );
		}
		return '';
	}

	/**
	 * @param mixed $value
	 * @return string[]
	 */
	public static function listOf( $value ): array {
		if ( self::isList( $value ) ) {
			return array_map( array( self::class, 'toText' ), $value );
		}
		return array( self::toText( $value ) );
	}

	public static function norm( string $s ): string {
		$s = trim( $s );
		return function_exists( 'mb_strtolower' ) ? mb_strtolower( $s, 'UTF-8' ) : strtolower( $s );
	}

	/**
	 * @param mixed $s
	 */
	public static function isNumeric( $s ): bool {
		if ( is_int( $s ) || is_float( $s ) ) {
			return is_finite( (float) $s );
		}
		return is_string( $s ) && preg_match( self::NUMERIC_RE, $s ) === 1;
	}

	public static function textEquals( string $a, string $b ): bool {
		if ( self::isNumeric( $a ) && self::isNumeric( $b ) ) {
			return (float) $a === (float) $b;
		}
		return self::norm( $a ) === self::norm( $b );
	}

	/**
	 * @param string[] $items
	 */
	private static function anyEquals( array $items, string $c ): bool {
		foreach ( $items as $x ) {
			if ( self::textEquals( $x, $c ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param mixed $value
	 */

	/**
	 * @param array<int,mixed>           $nodes
	 * @param array<string,array>        $map
	 */
	private function indexFields( array $nodes, array &$map ): void {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) || self::isList( $node ) ) {
				continue;
			}
			$key = $node['key'] ?? ( $node['config']['key'] ?? '' );
			if ( is_string( $key ) && '' !== $key ) {
				$map[ $key ] = $node;
			}
			foreach ( self::childLists( $node ) as $list ) {
				$this->indexFields( $list, $map );
			}
		}
	}

	/**
	 * @param mixed       $value
	 * @param string[]    $items
	 * @param string      $expected
	 * @param array|null  $field
	 */
	private static function matches( $value, array $items, string $expected, $field ): bool {
		$type = is_array( $field ) ? (string) ( $field['type'] ?? '' ) : '';
		if ( in_array( $type, array( 'checkbox', 'consent' ), true ) ) {
			return self::sameCheck( $value, $expected );
		}
		if ( 'country' === $type ) {
			return self::anyCountryEquals( $items, $expected );
		}
		return self::anyEquals( $items, $expected );
	}

	/**
	 * A Country field stores the ISO code or the name, depending on its
	 * Output Format, and a rule holds the code the builder picked. Both sides
	 * are compared as codes when they name a known country (FB-20).
	 *
	 * @param string[] $items
	 */
	public static function anyCountryEquals( array $items, string $expected ): bool {
		$want = \SubtleForms\Fields\CountryList::codeFor( $expected );
		foreach ( $items as $x ) {
			$have = \SubtleForms\Fields\CountryList::codeFor( $x );
			if ( '' !== $want && '' !== $have ) {
				if ( $want === $have ) {
					return true;
				}
				continue;
			}
			if ( self::textEquals( $x, $expected ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param mixed  $actual
	 * @param string $expected
	 */
	private static function sameCheck( $actual, string $expected ): bool {
		$yes = array( 'true', '1', 'yes', 'checked', 'on' );
		$no  = array( 'false', '0', 'no', 'unchecked', 'off', '' );
		$a    = is_bool( $actual ) ? ( $actual ? 'true' : 'false' ) : strtolower( trim( self::toText( $actual ) ) );
		$e    = strtolower( trim( $expected ) );
		if ( in_array( $e, $yes, true ) && in_array( $a, $yes, true ) ) {
			return true;
		}
		if ( in_array( $e, $no, true ) && in_array( $a, $no, true ) ) {
			return true;
		}
		return $a === $e;
	}

	/**
	 * @param mixed      $value
	 * @param array|null $field
	 */
	private static function isEmptyForField( $value, $field ): bool {
		if ( is_array( $field ) && 'toggle' === ( $field['type'] ?? '' ) ) {
			$off = (string) ( $field['config']['offValue'] ?? ( $field['offValue'] ?? 'no' ) );
			return self::isEmptyValue( $value ) || self::textEquals( self::toText( $value ), $off );
		}
		return self::isEmptyValue( $value );
	}

	public static function isEmptyValue( $value ): bool {
		if ( $value === null || $value === false ) {
			return true;
		}
		if ( is_string( $value ) ) {
			return trim( $value ) === '';
		}
		if ( is_array( $value ) ) {
			foreach ( $value as $v ) {
				if ( ! self::isEmptyValue( $v ) ) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	/**
	 * The day "today" means in a rule (Y-m-d), for add-on operators.
	 */
	public function today(): string {
		if ( $this->today !== null ) {
			return $this->today;
		}
		return function_exists( 'wp_date' ) ? (string) wp_date( 'Y-m-d' ) : gmdate( 'Y-m-d' );
	}
}
