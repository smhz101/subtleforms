<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

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
 * Groups are OR'ed; a group passes when all (or any) of its rules match. The
 * older `conditions` list ({ sourceField, operator, value, effect }) is still
 * read: rules that share an effect form one "all" group.
 */
final class ConditionalLogic {

	/** Operators available on every plan. */
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

	/** Operators that need logic.conditional.advanced. */
	public const ADVANCED_OPERATORS = array(
		'starts_with',
		'ends_with',
		'in',
		'not_in',
		'between',
		'before',
		'after',
	);

	private const NUMERIC_RE = '/^\s*[-+]?(\d+(\.\d*)?|\.\d+)\s*$/';
	private const DATE_RE    = '/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/';
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
	public function visiblePayload( array $schema, array $payload ): array {
		$state = $this->evaluate( $schema, $payload );
		return self::withoutKeys( $payload, $state['hidden_fields'] );
	}

	/**
	 * Whether a logic object's conditions are met. Inactive logic passes.
	 *
	 * @param mixed               $logic
	 * @param array<string,mixed> $values
	 */
	public function logicPasses( $logic, array $values ): bool {
		$l = self::normalizeLogic( $logic );
		if ( $l === null ) {
			return true;
		}
		foreach ( $l['groups'] as $group ) {
			$hits = 0;
			foreach ( $group['rules'] as $rule ) {
				if ( $this->evaluateCondition( self::readValue( $values, $rule['field'] ), $rule['operator'], $rule['value'], $rule['value2'] ) ) {
					++$hits;
				}
			}
			$passes = $group['match'] === 'any' ? $hits > 0 : $hits === count( $group['rules'] );
			if ( $passes ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a logic object has at least one rule.
	 *
	 * @param mixed $logic
	 */
	public static function hasLogic( $logic ): bool {
		return self::normalizeLogic( $logic ) !== null;
	}

	/**
	 * Whether a logic object uses anything beyond the free basics.
	 *
	 * @param mixed $logic
	 */
	public static function usesAdvancedLogic( $logic ): bool {
		$l = self::normalizeLogic( $logic );
		if ( $l === null ) {
			return false;
		}
		if ( count( $l['groups'] ) > 1 ) {
			return true;
		}
		foreach ( $l['groups'] as $group ) {
			if ( $group['match'] === 'any' ) {
				return true;
			}
			foreach ( $group['rules'] as $rule ) {
				if ( in_array( $rule['operator'], self::ADVANCED_OPERATORS, true ) ) {
					return true;
				}
			}
		}
		return false;
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
			if ( self::hasLogic( $c['logic'] ?? null ) && $this->logicPasses( $c['logic'], $values ) ) {
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
	public function evaluateCondition( $value, string $operator, $compare, $compare2 = '' ): bool {
		$today = $this->today();
		$items = self::listOf( $value );
		$c     = self::toText( $compare );

		switch ( $operator ) {
			case 'equals':
				return self::anyEquals( $items, $c );
			case 'not_equals':
				return ! self::anyEquals( $items, $c );
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
			case 'starts_with':
			case 'ends_with':
				$needle = self::norm( $c );
				if ( $needle === '' ) {
					return false;
				}
				foreach ( $items as $x ) {
					$x = self::norm( $x );
					$hit = $operator === 'starts_with'
						? strncmp( $x, $needle, strlen( $needle ) ) === 0
						: ( strlen( $x ) >= strlen( $needle ) && substr( $x, -strlen( $needle ) ) === $needle );
					if ( $hit ) {
						return true;
					}
				}
				return false;
			case 'empty':
				return self::isEmptyValue( $value );
			case 'not_empty':
				return ! self::isEmptyValue( $value );
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
			case 'in':
			case 'not_in':
				$options = self::optionList( $compare );
				$found   = false;
				if ( ! self::isEmptyValue( $value ) ) {
					foreach ( $items as $x ) {
						foreach ( $options as $o ) {
							if ( self::textEquals( $x, $o ) ) {
								$found = true;
								break 2;
							}
						}
					}
				}
				return $operator === 'in' ? $found : ! $found;
			case 'between':
				$lo = $compare;
				$hi = $compare2;
				if ( self::isList( $compare ) && count( $compare ) === 2 ) {
					$lo = $compare[0];
					$hi = $compare[1];
				}
				foreach ( $items as $x ) {
					if ( self::inRange( $x, self::toText( $lo ), self::toText( $hi ), $today ) ) {
						return true;
					}
				}
				return false;
			case 'before':
			case 'after':
				$limit = self::toDate( $c, $today );
				if ( $limit === null ) {
					return false;
				}
				foreach ( $items as $x ) {
					$d = self::toDate( $x, $today );
					if ( $d === null ) {
						continue;
					}
					if ( $operator === 'before' ? strcmp( $d, $limit ) < 0 : strcmp( $d, $limit ) > 0 ) {
						return true;
					}
				}
				return false;
			default:
				return false;
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
		$this->walk( $fields, $values, false, $state );
		return $state;
	}

	/**
	 * @param array<int,mixed>    $nodes
	 * @param array<string,mixed> $values
	 * @param bool                $parentHidden
	 * @param array               $state
	 */
	private function walk( array $nodes, array $values, bool $parentHidden, array &$state ): void {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) || self::isList( $node ) ) {
				continue;
			}
			$key    = self::nodeKey( $node );
			$hidden = $parentHidden;

			foreach ( self::nodeLogics( $node ) as $l ) {
				$passes = $this->logicPasses( $l, $values );
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

			foreach ( self::childLists( $node ) as $list ) {
				$this->walk( $list, $values, $hidden, $state );
			}
		}
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
			unset( $values[ $k ] );
		}
		return $values;
	}

	/**
	 * @param array<string,mixed> $values
	 * @return mixed
	 */
	private static function readValue( array $values, string $key ) {
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
	private static function isList( $value ): bool {
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
	private static function listOf( $value ): array {
		if ( self::isList( $value ) ) {
			return array_map( array( self::class, 'toText' ), $value );
		}
		return array( self::toText( $value ) );
	}

	private static function norm( string $s ): string {
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

	/**
	 * ISO date as a sortable "YYYY-MM-DD HH:MM:SS" string, or null.
	 */
	public static function toDate( string $s, string $today ): ?string {
		$str = trim( $s );
		if ( strtolower( $str ) === 'today' ) {
			$str = $today;
		}
		if ( ! preg_match( self::DATE_RE, $str, $m ) ) {
			return null;
		}
		return sprintf(
			'%s-%s-%s %s:%s:%s',
			$m[1],
			$m[2],
			$m[3],
			isset( $m[4] ) && $m[4] !== '' ? $m[4] : '00',
			isset( $m[5] ) && $m[5] !== '' ? $m[5] : '00',
			isset( $m[6] ) && $m[6] !== '' ? $m[6] : '00'
		);
	}

	private static function textEquals( string $a, string $b ): bool {
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
	 * @param mixed $compare
	 * @return string[]
	 */
	private static function optionList( $compare ): array {
		$raw = self::isList( $compare )
			? array_map( array( self::class, 'toText' ), $compare )
			: explode( ',', self::toText( $compare ) );
		$out = array();
		foreach ( $raw as $o ) {
			$o = trim( $o );
			if ( $o !== '' ) {
				$out[] = $o;
			}
		}
		return $out;
	}

	private static function inRange( string $x, string $min, string $max, string $today ): bool {
		if ( self::isNumeric( $x ) && self::isNumeric( $min ) && self::isNumeric( $max ) ) {
			$n = (float) $x;
			return $n >= (float) $min && $n <= (float) $max;
		}
		$d  = self::toDate( $x, $today );
		$lo = self::toDate( $min, $today );
		$hi = self::toDate( $max, $today );
		return $d !== null && $lo !== null && $hi !== null && strcmp( $d, $lo ) >= 0 && strcmp( $d, $hi ) <= 0;
	}

	private function today(): string {
		if ( $this->today !== null ) {
			return $this->today;
		}
		return function_exists( 'wp_date' ) ? (string) wp_date( 'Y-m-d' ) : gmdate( 'Y-m-d' );
	}
}
