<?php

/**
 * Repeater answers (2.3.1).
 *
 * A Repeater stores its answer under its own key as a list of groups, each
 * group an object keyed by the child field keys:
 *
 *     "companies": [ { "ticker": "AAPL", "shares": "8" }, { "ticker": "MSFT", "shares": "2" } ]
 *
 * The browser may post that list or the indexed form `companies[0][ticker]`;
 * both arrive here as arrays and are normalised to a plain list.
 *
 * This class validates and cleans the groups and formats them for entries,
 * emails, the PDF (through FieldMapper::answers()) and CSV export.
 *
 * @package SubtleForms\Support
 * @since   2.3.1
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Helpers for Repeater (repeat_container) answers.
 */
final class Repeater {

	public const TYPE = 'repeat_container';

	/**
	 * Default and hard limits for the number of groups.
	 */
	public const DEFAULT_MIN = 1;
	public const DEFAULT_MAX = 5;
	public const HARD_MAX    = 100;

	/**
	 * Whether a node is a Repeater.
	 *
	 * @param mixed $node Field node.
	 */
	public static function isRepeater( $node ): bool {
		return is_array( $node ) && ( $node['type'] ?? '' ) === self::TYPE;
	}

	/**
	 * Read a setting from a flat node or its `config`.
	 *
	 * @param array  $node Field node.
	 * @param string $name Setting.
	 * @return mixed
	 */
	private static function attr( array $node, string $name ) {
		if ( array_key_exists( $name, $node ) ) {
			return $node[ $name ];
		}
		return is_array( $node['config'] ?? null ) ? ( $node['config'][ $name ] ?? null ) : null;
	}

	/**
	 * Minimum and maximum groups for a Repeater.
	 *
	 * @param array $node Repeater node.
	 * @return array{0:int,1:int}
	 */
	public static function limits( array $node ): array {
		$min = self::attr( $node, 'min' );
		$max = self::attr( $node, 'max' );
		$min = is_numeric( $min ) ? max( 0, (int) $min ) : self::DEFAULT_MIN;
		$max = is_numeric( $max ) && (int) $max > 0 ? (int) $max : self::DEFAULT_MAX;
		$max = min( self::HARD_MAX, max( $max, $min, 1 ) );
		return array( $min, $max );
	}

	/**
	 * Child field nodes of a Repeater (children or legacy fields).
	 *
	 * @param array $node Repeater node.
	 * @return array<int,array>
	 */
	public static function children( array $node ): array {
		foreach ( array( 'children', 'fields' ) as $list ) {
			if ( isset( $node[ $list ] ) && is_array( $node[ $list ] ) && ( ! $node[ $list ] || isset( $node[ $list ][0] ) ) ) {
				return array_values( array_filter( $node[ $list ], 'is_array' ) );
			}
		}
		return array();
	}

	/**
	 * Answer-bearing child fields (FieldMapper entries).
	 *
	 * @param array $node Repeater node.
	 * @return array<int,array{key:string,label:string,type:string,field:array}>
	 */
	public static function childFields( array $node ): array {
		return FieldMapper::fields( array( 'fields' => self::children( $node ) ) );
	}

	/**
	 * Normalise a posted value to a list of groups.
	 *
	 * @param mixed $value List of groups or an indexed map.
	 * @return array<int,array<string,mixed>>
	 */
	public static function groups( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$keys = array_values(
			array_filter(
				array_keys( $value ),
				static function ( $k ) {
					return is_int( $k ) || ( is_string( $k ) && ctype_digit( $k ) );
				}
			)
		);
		sort( $keys, SORT_NUMERIC );
		$groups = array();
		foreach ( $keys as $k ) {
			$groups[] = is_array( $value[ $k ] ) ? $value[ $k ] : array();
		}
		return $groups;
	}

	/**
	 * Whether a stored value looks like Repeater groups.
	 *
	 * @param mixed $value Value.
	 */
	public static function looksLikeGroups( $value ): bool {
		if ( ! is_array( $value ) || ! $value || array_keys( $value ) !== range( 0, count( $value ) - 1 ) ) {
			return false;
		}
		foreach ( $value as $group ) {
			if ( ! is_array( $group ) || ( $group && isset( $group[0] ) ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Every Repeater in a schema, by key.
	 *
	 * @param array $fields Field list.
	 * @param array $out    Collected nodes.
	 * @return array<string,array>
	 */
	public static function find( array $fields, array &$out = array() ): array {
		foreach ( $fields as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( self::isRepeater( $node ) ) {
				$key = (string) ( $node['key'] ?? ( $node['config']['key'] ?? '' ) );
				if ( '' !== $key ) {
					$out[ $key ] = $node;
				}
				continue;
			}
			foreach ( array( 'children', 'fields' ) as $list ) {
				if ( isset( $node[ $list ] ) && is_array( $node[ $list ] ) ) {
					self::find( $node[ $list ], $out );
				}
			}
			if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
				foreach ( $node['columns'] as $col ) {
					if ( is_array( $col ) && isset( $col[0] ) && is_array( $col[0] ) ) {
						self::find( $col, $out );
					}
				}
			}
		}
		return $out;
	}

	/**
	 * A validation view of the form: each Repeater's children are replaced by
	 * one copy per submitted group with keys like `companies.0.ticker`, and
	 * the payload gets the matching flat answers. The regular field validator
	 * then checks every group's required and format rules, and its errors are
	 * keyed by the same paths the browser uses for each group's inputs.
	 *
	 * @param array $schema  Schema.
	 * @param array $payload Payload (groups under the Repeater key).
	 * @return array{schema: array, payload: array}
	 */
	public static function expandForValidation( array $schema, array $payload ): array {
		$flat           = $payload;
		$schema['fields'] = self::expandList( is_array( $schema['fields'] ?? null ) ? $schema['fields'] : array(), $payload, $flat );
		return array(
			'schema'  => $schema,
			'payload' => $flat,
		);
	}

	/**
	 * @param array $fields  Field list.
	 * @param array $payload Original payload.
	 * @param array $flat    Flat payload, by reference.
	 * @return array
	 */
	private static function expandList( array $fields, array $payload, array &$flat ): array {
		foreach ( $fields as $i => $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( self::isRepeater( $node ) ) {
				$key      = (string) ( $node['key'] ?? ( $node['config']['key'] ?? '' ) );
				$groups   = self::groups( $payload[ $key ] ?? array() );
				list( $min ) = self::limits( $node );
				// Required children of groups the visitor must fill are checked
				// even when nothing was posted for them.
				$count    = max( count( $groups ), $min );
				$expanded = array();
				for ( $g = 0; $g < $count; $g++ ) {
					foreach ( self::children( $node ) as $child ) {
						$expanded[] = self::prefixNode( $child, $key . '.' . $g . '.', $groups[ $g ] ?? array(), $flat );
					}
				}
				$node['children'] = $expanded;
				unset( $node['fields'] );
				$fields[ $i ] = $node;
				continue;
			}
			foreach ( array( 'children', 'fields' ) as $list ) {
				if ( isset( $node[ $list ] ) && is_array( $node[ $list ] ) && ( ! $node[ $list ] || isset( $node[ $list ][0] ) ) ) {
					$node[ $list ] = self::expandList( $node[ $list ], $payload, $flat );
				}
			}
			if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
				foreach ( $node['columns'] as $c => $col ) {
					if ( is_array( $col ) && isset( $col[0] ) && is_array( $col[0] ) ) {
						$node['columns'][ $c ] = self::expandList( $col, $payload, $flat );
					}
				}
			}
			$fields[ $i ] = $node;
		}
		return $fields;
	}

	/**
	 * Copy a child (and anything inside it) with prefixed keys, adding its
	 * answers to the flat payload.
	 *
	 * @param array  $node   Child node.
	 * @param string $prefix Key prefix such as `companies.1.`.
	 * @param array  $group  The group's answers.
	 * @param array  $flat   Flat payload, by reference.
	 * @return array
	 */
	private static function prefixNode( array $node, string $prefix, array $group, array &$flat ): array {
		$key = (string) ( $node['key'] ?? ( $node['config']['key'] ?? '' ) );
		if ( '' !== $key ) {
			$node['key'] = $prefix . $key;
			if ( isset( $node['config'] ) && is_array( $node['config'] ) && isset( $node['config']['key'] ) ) {
				$node['config']['key'] = $prefix . $key;
			}
			if ( array_key_exists( $key, $group ) ) {
				$flat[ $prefix . $key ] = $group[ $key ];
			}
		}
		foreach ( array( 'children', 'fields' ) as $list ) {
			if ( isset( $node[ $list ] ) && is_array( $node[ $list ] ) && ( ! $node[ $list ] || isset( $node[ $list ][0] ) ) ) {
				foreach ( $node[ $list ] as $j => $child ) {
					if ( is_array( $child ) ) {
						$node[ $list ][ $j ] = self::prefixNode( $child, $prefix, $group, $flat );
					}
				}
			}
		}
		if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
			foreach ( $node['columns'] as $c => $col ) {
				if ( is_array( $col ) && isset( $col[0] ) && is_array( $col[0] ) ) {
					foreach ( $col as $j => $child ) {
						$node['columns'][ $c ][ $j ] = self::prefixNode( $child, $prefix, $group, $flat );
					}
				}
			}
		}
		return $node;
	}

	/**
	 * Errors for too few or too many groups, keyed by the Repeater key.
	 *
	 * @param array    $schema Schema.
	 * @param array    $payload Payload.
	 * @param string[] $hidden Hidden field keys (a hidden Repeater is not checked).
	 * @return array<string,string>
	 */
	public static function countErrors( array $schema, array $payload, array $hidden = array() ): array {
		$errors = array();
		foreach ( self::find( is_array( $schema['fields'] ?? null ) ? $schema['fields'] : array() ) as $key => $node ) {
			if ( in_array( $key, $hidden, true ) ) {
				continue;
			}
			list( $min, $max ) = self::limits( $node );
			$count             = count( self::groups( $payload[ $key ] ?? array() ) );
			if ( $count > $max ) {
				/* translators: %d: maximum number of groups */
				$errors[ $key ] = sprintf( _n( 'Add no more than %d entry.', 'Add no more than %d entries.', $max, 'subtleforms' ), $max );
			}
			// Fewer groups than the minimum is not an error by itself: the
			// browser always sends `min` groups, and the required children of
			// missing groups are reported on their own inputs.
			unset( $min );
		}
		return $errors;
	}

	/**
	 * Clean the groups for storage: a plain list, at most `max` groups, only
	 * known child keys, each value cleaned by the caller's sanitizer.
	 *
	 * @param array    $node      Repeater node.
	 * @param mixed    $value     Posted value.
	 * @param callable $sanitize  function( array $childSchema, array $group ): array.
	 * @return array<int,array<string,mixed>>
	 */
	public static function clean( array $node, $value, callable $sanitize ): array {
		list( , $max ) = self::limits( $node );
		$schema         = array( 'fields' => self::children( $node ) );
		$out            = array();
		foreach ( array_slice( self::groups( $value ), 0, $max ) as $group ) {
			$out[] = (array) $sanitize( $schema, $group );
		}
		return $out;
	}

	/**
	 * Groups as plain text: one numbered line per group.
	 *
	 * @param mixed $value Stored groups.
	 * @param array $node  Repeater node.
	 */
	public static function toText( $value, array $node ): string {
		$lines = array();
		foreach ( self::rows( $value, $node ) as $n => $cells ) {
			$parts = array();
			foreach ( $cells as $cell ) {
				$parts[] = $cell['label'] . ': ' . $cell['value'];
			}
			$lines[] = ( $n + 1 ) . '. ' . implode( '; ', $parts );
		}
		return implode( "\n", $lines );
	}

	/**
	 * Groups as an HTML table (one row per group, one column per child).
	 *
	 * @param mixed $value Stored groups.
	 * @param array $node  Repeater node.
	 */
	public static function toHtml( $value, array $node ): string {
		$children = self::childFields( $node );
		$groups   = self::groups( $value );
		if ( ! $groups || ! $children ) {
			return '';
		}
		$cell = 'style="border:1px solid #e5e7eb;padding:4px 8px;text-align:left;vertical-align:top;"';
		$html = '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;"><thead><tr><th ' . $cell . '>#</th>';
		foreach ( $children as $child ) {
			$html .= '<th ' . $cell . '>' . esc_html( '' !== $child['label'] ? $child['label'] : $child['key'] ) . '</th>';
		}
		$html .= '</tr></thead><tbody>';
		foreach ( $groups as $n => $group ) {
			$html .= '<tr><td ' . $cell . '>' . ( $n + 1 ) . '</td>';
			foreach ( $children as $child ) {
				$text  = self::childText( $group[ $child['key'] ] ?? null, $child );
				$html .= '<td ' . $cell . '>' . nl2br( esc_html( $text ) ) . '</td>';
			}
			$html .= '</tr>';
		}
		return $html . '</tbody></table>';
	}

	/**
	 * Answered cells of each group: [ [ ['key','label','value'], ... ], ... ].
	 *
	 * @param mixed $value Stored groups.
	 * @param array $node  Repeater node.
	 * @return array<int,array<int,array{key:string,label:string,value:string}>>
	 */
	public static function rows( $value, array $node ): array {
		$children = self::childFields( $node );
		$rows     = array();
		foreach ( self::groups( $value ) as $group ) {
			$cells = array();
			foreach ( $children as $child ) {
				if ( ! array_key_exists( $child['key'], $group ) ) {
					continue;
				}
				$text = self::childText( $group[ $child['key'] ], $child );
				if ( '' === $text ) {
					continue;
				}
				$cells[] = array(
					'key'   => $child['key'],
					'label' => '' !== $child['label'] ? $child['label'] : $child['key'],
					'value' => $text,
				);
			}
			if ( $cells ) {
				$rows[] = $cells;
			}
		}
		return $rows;
	}

	/**
	 * CSV columns for a Repeater: one per child, groups on separate lines
	 * in the same order in every column (2.3.1, documented in readme.txt).
	 *
	 * @param mixed $value Stored groups.
	 * @param array $node  Repeater node.
	 * @return array<string,string> Child key => cell text.
	 */
	public static function csvCells( $value, array $node ): array {
		$groups = self::groups( $value );
		$out    = array();
		foreach ( self::childFields( $node ) as $child ) {
			$lines = array();
			foreach ( $groups as $group ) {
				$lines[] = self::childText( $group[ $child['key'] ] ?? null, $child );
			}
			$out[ $child['key'] ] = implode( "\n", $lines );
		}
		return $out;
	}

	/**
	 * One child answer as text.
	 *
	 * @param mixed $value Answer.
	 * @param array $child FieldMapper entry.
	 */
	private static function childText( $value, array $child ): string {
		if ( null === $value ) {
			return '';
		}
		if ( 'consent' === $child['type'] ) {
			return FieldMapper::isChecked( $value, $child['field'] ) ? __( 'Yes', 'subtleforms' ) : __( 'No', 'subtleforms' );
		}
		return EntryValues::toText( FieldMapper::optionLabels( $value, $child['field'] ), $child['field'] );
	}
}
