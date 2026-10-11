<?php
/**
 * Safe arithmetic formula evaluator for Calculation fields.
 *
 * Formulas reference other fields by key in braces: `{quantity} * {price}`.
 * Only numbers, + - * / %, brackets and a small set of functions are allowed.
 * There is no eval(): the expression is tokenised and evaluated with a
 * recursive-descent parser, so anything outside the grammar yields 0.
 *
 * The same grammar is implemented in resources/frontend/utils/formula.js; the
 * server recomputes every calculation on submit so a visitor cannot post a
 * tampered total.
 *
 * @package SubtleForms\Engine
 * @since   2.0.0
 */

namespace SubtleForms\Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Formula evaluator.
 */
final class Formula {

	/** @var array<int, array{0:string,1:string}> */
	private array $tokens = array();

	private int $pos = 0;

	/**
	 * Evaluate a formula against submitted values.
	 *
	 * @param string               $formula  Formula text.
	 * @param array<string, mixed> $values   Values keyed by field key.
	 * @param int                  $decimals Decimal places to round to.
	 * @return float
	 */
	public static function evaluate( string $formula, array $values, int $decimals = 2 ): float {
		$expr = preg_replace_callback(
			'/\{([a-zA-Z0-9_\-.]+)\}/',
			static function ( $m ) use ( $values ) {
				return (string) self::toNumber( self::lookup( $values, $m[1] ) );
			},
			$formula
		);

		$parser = new self();
		try {
			$parser->tokens = $parser->tokenize( (string) $expr );
			$parser->pos    = 0;
			$result         = $parser->parseExpression();
			if ( $parser->pos !== count( $parser->tokens ) ) {
				return 0.0;
			}
		} catch ( \Throwable $e ) {
			return 0.0;
		}

		if ( ! is_finite( $result ) ) {
			return 0.0;
		}

		return round( $result, max( 0, min( 6, $decimals ) ) );
	}

	/**
	 * Resolve a dotted key in the values array.
	 *
	 * @param array  $values Values.
	 * @param string $key    Key, optionally dotted.
	 * @return mixed
	 */
	private static function lookup( array $values, string $key ) {
		if ( array_key_exists( $key, $values ) ) {
			return $values[ $key ];
		}
		$cursor = $values;
		foreach ( explode( '.', $key ) as $part ) {
			if ( ! is_array( $cursor ) || ! array_key_exists( $part, $cursor ) ) {
				return 0;
			}
			$cursor = $cursor[ $part ];
		}
		return $cursor;
	}

	/**
	 * Coerce a submitted value to a number. Arrays sum their numeric members
	 * (so checkbox values like "10" can be totalled).
	 *
	 * @param mixed $value Value.
	 * @return float
	 */
	private static function toNumber( $value ): float {
		if ( is_bool( $value ) ) {
			return $value ? 1.0 : 0.0;
		}
		if ( is_array( $value ) ) {
			$sum = 0.0;
			foreach ( $value as $item ) {
				$sum += self::toNumber( $item );
			}
			return $sum;
		}
		if ( is_numeric( $value ) ) {
			return (float) $value;
		}
		if ( is_string( $value ) ) {
			$clean = preg_replace( '/[^0-9.\-]/', '', $value );
			return is_numeric( $clean ) ? (float) $clean : 0.0;
		}
		return 0.0;
	}

	/**
	 * @param string $expr Expression with values substituted.
	 * @return array<int, array{0:string,1:string}>
	 */
	private function tokenize( string $expr ): array {
		$tokens = array();
		$len    = strlen( $expr );
		$i      = 0;
		while ( $i < $len ) {
			$c = $expr[ $i ];
			if ( ctype_space( $c ) ) {
				++$i;
				continue;
			}
			if ( ctype_digit( $c ) || $c === '.' ) {
				$start = $i;
				while ( $i < $len && ( ctype_digit( $expr[ $i ] ) || $expr[ $i ] === '.' ) ) {
					++$i;
				}
				$tokens[] = array( 'num', substr( $expr, $start, $i - $start ) );
				continue;
			}
			if ( ctype_alpha( $c ) ) {
				$start = $i;
				while ( $i < $len && ctype_alpha( $expr[ $i ] ) ) {
					++$i;
				}
				$tokens[] = array( 'fn', strtolower( substr( $expr, $start, $i - $start ) ) );
				continue;
			}
			if ( strpos( '+-*/%(),', $c ) !== false ) {
				$tokens[] = array( 'op', $c );
				++$i;
				continue;
			}
			throw new \InvalidArgumentException( 'Unexpected character' );
		}
		return $tokens;
	}

	private function peek(): ?array {
		return $this->tokens[ $this->pos ] ?? null;
	}

	private function parseExpression(): float {
		$value = $this->parseTerm();
		while ( ( $t = $this->peek() ) && $t[0] === 'op' && ( $t[1] === '+' || $t[1] === '-' ) ) {
			++$this->pos;
			$rhs   = $this->parseTerm();
			$value = $t[1] === '+' ? $value + $rhs : $value - $rhs;
		}
		return $value;
	}

	private function parseTerm(): float {
		$value = $this->parseUnary();
		while ( ( $t = $this->peek() ) && $t[0] === 'op' && in_array( $t[1], array( '*', '/', '%' ), true ) ) {
			++$this->pos;
			$rhs = $this->parseUnary();
			if ( $t[1] === '*' ) {
				$value *= $rhs;
			} elseif ( $t[1] === '/' ) {
				$value = $rhs == 0.0 ? 0.0 : $value / $rhs;
			} else {
				$value = $rhs == 0.0 ? 0.0 : fmod( $value, $rhs );
			}
		}
		return $value;
	}

	private function parseUnary(): float {
		$t = $this->peek();
		if ( $t && $t[0] === 'op' && ( $t[1] === '-' || $t[1] === '+' ) ) {
			++$this->pos;
			$v = $this->parseUnary();
			return $t[1] === '-' ? -$v : $v;
		}
		return $this->parsePrimary();
	}

	private function parsePrimary(): float {
		$t = $this->peek();
		if ( ! $t ) {
			throw new \InvalidArgumentException( 'Unexpected end' );
		}
		if ( $t[0] === 'num' ) {
			++$this->pos;
			return (float) $t[1];
		}
		if ( $t[0] === 'op' && $t[1] === '(' ) {
			++$this->pos;
			$v = $this->parseExpression();
			$this->expect( ')' );
			return $v;
		}
		if ( $t[0] === 'fn' ) {
			++$this->pos;
			$this->expect( '(' );
			$args = array( $this->parseExpression() );
			while ( ( $n = $this->peek() ) && $n[0] === 'op' && $n[1] === ',' ) {
				++$this->pos;
				$args[] = $this->parseExpression();
			}
			$this->expect( ')' );
			switch ( $t[1] ) {
				case 'round':
					return round( $args[0], (int) ( $args[1] ?? 0 ) );
				case 'floor':
					return floor( $args[0] );
				case 'ceil':
					return ceil( $args[0] );
				case 'abs':
					return abs( $args[0] );
				case 'min':
					return min( $args );
				case 'max':
					return max( $args );
				default:
					throw new \InvalidArgumentException( 'Unknown function' );
			}
		}
		throw new \InvalidArgumentException( 'Unexpected token' );
	}

	private function expect( string $op ): void {
		$t = $this->peek();
		if ( ! $t || $t[0] !== 'op' || $t[1] !== $op ) {
			throw new \InvalidArgumentException( 'Expected ' . $op );
		}
		++$this->pos;
	}
}
