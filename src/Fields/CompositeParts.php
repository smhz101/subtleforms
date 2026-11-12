<?php
/**
 * Name and Address parts: which are drawn and which a required field demands.
 *
 * The settings live in `fields`, a map keyed by part (`first_name`,
 * `street2`). Forms saved before 2.3.9 may hold it as a list without keys, or
 * only the older `enable_*` flags; both are read here. Mirrors
 * resources/shared/compositeParts.js (FB-01, FB-02, FB-10).
 *
 * @package SubtleForms\Fields
 * @since   2.3.9
 */

declare(strict_types=1);

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CompositeParts {

	/**
	 * Parts in the order the builder lists them. `value` is the answer key,
	 * `alias` an older answer key, `optional` parts are never demanded.
	 */
	private const PARTS = array(
		'name_group'    => array(
			array( 'part' => 'first_name', 'value' => 'first_name', 'label' => 'First Name', 'toggleable' => false, 'on' => true ),
			array( 'part' => 'last_name', 'value' => 'last_name', 'label' => 'Last Name', 'toggleable' => false, 'on' => true ),
			array( 'part' => 'middle_name', 'value' => 'middle_name', 'label' => 'Middle Name', 'toggleable' => true, 'on' => false, 'optional' => true ),
			array( 'part' => 'suffix', 'value' => 'suffix', 'label' => 'Suffix', 'toggleable' => true, 'on' => false, 'optional' => true ),
		),
		'address_group' => array(
			array( 'part' => 'street', 'value' => 'street_address', 'alias' => 'street', 'label' => 'Street Address', 'toggleable' => false, 'on' => true, 'flags' => array( 'enable_street1', 'enable_street' ) ),
			array( 'part' => 'street2', 'value' => 'street_address_2', 'alias' => 'street2', 'label' => 'Street Address Line 2', 'toggleable' => true, 'on' => false, 'optional' => true ),
			array( 'part' => 'city', 'value' => 'city', 'label' => 'City', 'toggleable' => false, 'on' => true ),
			array( 'part' => 'state', 'value' => 'state', 'label' => 'State / Province', 'toggleable' => true, 'on' => true ),
			array( 'part' => 'postal', 'value' => 'postal_code', 'alias' => 'postal', 'label' => 'Postal Code', 'toggleable' => true, 'on' => true, 'flags' => array( 'enable_postal', 'enable_postal_code' ) ),
			array( 'part' => 'country', 'value' => 'country', 'label' => 'Country', 'toggleable' => true, 'on' => true ),
		),
	);

	/**
	 * Parts per type once add-ons have been asked, kept for the request.
	 *
	 * @var array<string,array<int,array>>
	 */
	private static array $cache = array();

	/**
	 * Forget the parts read so far (tests, or an add-on that registers its
	 * filter late).
	 */
	public static function resetCache(): void {
		self::$cache = array();
	}

	/**
	 * The parts of a type: the built-in ones, then those an add-on appended
	 * through `subtleforms/fields/composite_parts`.
	 *
	 * Built-in parts cannot be replaced, changed or removed that way. An
	 * added part must be an array with a `part` and a `value` key (lower case
	 * letters, digits and underscores, starting with a letter); anything else,
	 * and any part whose name or answer key is already taken, is dropped.
	 * A part with `data => true` is stored with the answer but never drawn,
	 * demanded or shown as text.
	 *
	 * @param string $type Field type.
	 * @return array<int,array>
	 */
	private static function defs( string $type ): array {
		if ( isset( self::$cache[ $type ] ) ) {
			return self::$cache[ $type ];
		}
		$defs = self::PARTS[ $type ] ?? array();
		if ( array() === $defs ) {
			return array();
		}
		if ( function_exists( 'apply_filters' ) ) {
			/**
			 * Add parts to a composite field (Name, Address). Return the list
			 * you received with your parts appended. Only appended parts are
			 * used: built-in parts cannot be replaced or removed.
			 *
			 * A part is an array with `part` (settings key) and `value`
			 * (answer key), both matching /^[a-z][a-z0-9_]*$/, and optionally
			 * `alias`, `label`, `toggleable`, `on`, `optional`, `data`,
			 * `flags`, `auto`, `full` and `placeholder`. `data => true` keeps
			 * the value with the answer without drawing it, demanding it or
			 * showing it in entries, emails and exports.
			 *
			 * @param array  $parts Parts of the type, built-in ones first.
			 * @param string $type  Field type, `name_group` or `address_group`.
			 * @since 2.9.0
			 */
			$filtered = apply_filters( 'subtleforms/fields/composite_parts', $defs, $type );
			if ( is_array( $filtered ) ) {
				$taken = array();
				foreach ( $defs as $def ) {
					$taken[ $def['part'] ]  = true;
					$taken[ $def['value'] ] = true;
					if ( isset( $def['alias'] ) ) {
						$taken[ $def['alias'] ] = true;
					}
				}
				$builtIn = array_column( $defs, 'part' );
				foreach ( $filtered as $candidate ) {
					$def = self::cleanPart( $candidate );
					if ( null === $def || in_array( $def['part'], $builtIn, true ) ) {
						continue;
					}
					$names = array_filter( array( $def['part'], $def['value'], $def['alias'] ?? null ) );
					if ( array_intersect_key( array_flip( $names ), $taken ) ) {
						continue;
					}
					foreach ( $names as $name ) {
						$taken[ $name ] = true;
					}
					$defs[] = $def;
				}
			}
		}
		self::$cache[ $type ] = $defs;
		return $defs;
	}

	/**
	 * One part an add-on supplied, in the shape the built-in ones have, or
	 * null when it is not usable.
	 *
	 * @param mixed $part Part as supplied.
	 * @return array|null
	 */
	private static function cleanPart( $part ): ?array {
		$name = '/^[a-z][a-z0-9_]*$/';
		if ( ! is_array( $part )
			|| ! isset( $part['part'], $part['value'] )
			|| ! is_string( $part['part'] ) || ! is_string( $part['value'] )
			|| 1 !== preg_match( $name, $part['part'] ) || 1 !== preg_match( $name, $part['value'] ) ) {
			return null;
		}
		$data = ! empty( $part['data'] );
		$def  = array(
			'part'       => $part['part'],
			'value'      => $part['value'],
			'label'      => isset( $part['label'] ) && is_string( $part['label'] ) && '' !== $part['label'] ? $part['label'] : $part['part'],
			'toggleable' => ! $data && ! empty( $part['toggleable'] ),
			'on'         => $data || ! array_key_exists( 'on', $part ) || false !== $part['on'],
			'optional'   => $data || ! empty( $part['optional'] ),
			'data'       => $data,
		);
		if ( isset( $part['alias'] ) && is_string( $part['alias'] ) && 1 === preg_match( $name, $part['alias'] ) ) {
			$def['alias'] = $part['alias'];
		}
		if ( isset( $part['flags'] ) && is_array( $part['flags'] ) ) {
			$def['flags'] = array_values( array_filter( $part['flags'], 'is_string' ) );
		}
		foreach ( array( 'auto', 'placeholder' ) as $text ) {
			if ( isset( $part[ $text ] ) && is_string( $part[ $text ] ) ) {
				$def[ $text ] = $part[ $text ];
			}
		}
		$def['full'] = ! empty( $part['full'] );
		return $def;
	}

	/**
	 * Whether a type is made of parts.
	 */
	public static function has( string $type ): bool {
		return isset( self::PARTS[ $type ] );
	}

	/**
	 * The answer keys a type keeps: every part's `value` and `alias`, data
	 * parts included. Anything else posted for the field is not stored.
	 *
	 * @param string $type Field type.
	 * @return string[]
	 */
	public static function knownKeys( string $type ): array {
		$keys = array();
		foreach ( self::defs( $type ) as $def ) {
			$keys[] = $def['value'];
			if ( isset( $def['alias'] ) ) {
				$keys[] = $def['alias'];
			}
		}
		return array_values( array_unique( $keys ) );
	}

	/**
	 * The answer keys to read for a part name (`street`, `postal`, `first_name`):
	 * its `value` key, then its `alias`. Data parts and parts an add-on added
	 * are included. Empty when the type has no such part.
	 *
	 * @param string $type Field type.
	 * @param string $part Part name.
	 * @return string[]
	 */
	public static function valueKeys( string $type, string $part ): array {
		foreach ( self::defs( $type ) as $def ) {
			if ( $def['part'] === $part ) {
				return array_values( array_filter( array( $def['value'], $def['alias'] ?? null ) ) );
			}
		}
		return array();
	}

	/**
	 * The parts that make display text, in builder order: every part that
	 * is not a data part, whether drawn or not.
	 *
	 * @param string $type Field type.
	 * @return array<int,array{value:string,alias:?string}>
	 */
	public static function textParts( string $type ): array {
		$out = array();
		foreach ( self::defs( $type ) as $def ) {
			if ( empty( $def['data'] ) ) {
				$out[] = array(
					'value' => $def['value'],
					'alias' => $def['alias'] ?? null,
				);
			}
		}
		return $out;
	}

	/**
	 * The `fields` settings as a map keyed by part, repairing a list saved
	 * without keys (matched by part or label, else by position).
	 *
	 * @param string $type   Field type.
	 * @param mixed  $fields Stored `fields`.
	 * @return array<string,array>|null Null when nothing usable is stored.
	 */
	public static function settingsMap( string $type, $fields ): ?array {
		$defs = self::defs( $type );
		if ( array() === $defs || ! is_array( $fields ) || array() === $fields ) {
			return null;
		}
		if ( ! array_is_list( $fields ) ) {
			return $fields;
		}
		$out  = array();
		$left = array();
		foreach ( $fields as $index => $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$named = (string) ( $item['part'] ?? $item['key'] ?? '' );
			$label = strtolower( trim( (string) ( $item['label'] ?? '' ) ) );
			$match = null;
			foreach ( $defs as $def ) {
				if ( isset( $out[ $def['part'] ] ) ) {
					continue;
				}
				if ( $named === $def['part'] || $label === strtolower( $def['label'] ) ) {
					$match = $def['part'];
					break;
				}
			}
			if ( null === $match ) {
				$left[ $index ] = $item;
				continue;
			}
			$out[ $match ] = $item;
		}
		foreach ( $left as $index => $item ) {
			$ordered = array_merge( array_slice( $defs, (int) $index ), $defs );
			foreach ( $ordered as $def ) {
				if ( ! isset( $out[ $def['part'] ] ) ) {
					$out[ $def['part'] ] = $item;
					break;
				}
			}
		}
		return $out;
	}

	/**
	 * The parts a field draws.
	 *
	 * @param string $type  Field type.
	 * @param array  $field Field node (flat or with `config`).
	 * @return array<int,array{part:string,value:string,alias:?string,optional:bool,data:bool}>
	 */
	public static function parts( string $type, array $field ): array {
		$defs = self::defs( $type );
		if ( ! $defs ) {
			return array();
		}
		$config = isset( $field['config'] ) && is_array( $field['config'] ) ? array_merge( $field, $field['config'] ) : $field;
		$map    = self::settingsMap( $type, $config['fields'] ?? null );
		$out    = array();
		foreach ( $defs as $def ) {
			$on = true;
			if ( $def['toggleable'] ) {
				if ( null !== $map ) {
					$s  = $map[ $def['part'] ] ?? null;
					$on = is_array( $s ) && array_key_exists( 'enabled', $s ) ? false !== $s['enabled'] && 'false' !== $s['enabled'] : $def['on'];
				} else {
					$on = $def['on'];
					foreach ( $def['flags'] ?? array( 'enable_' . $def['part'] ) as $flag ) {
						if ( array_key_exists( $flag, $config ) ) {
							$on = false !== $config[ $flag ];
							break;
						}
					}
				}
			}
			if ( $on ) {
				$out[] = array(
					'part'     => $def['part'],
					'value'    => $def['value'],
					'alias'    => $def['alias'] ?? null,
					'optional' => ! empty( $def['optional'] ),
					'data'     => ! empty( $def['data'] ),
				);
			}
		}
		return $out;
	}

	/**
	 * The answer keys a required field still needs: every drawn part that
	 * is not optional.
	 *
	 * @param string $type  Field type.
	 * @param array  $field Field node.
	 * @param mixed  $value Answer.
	 * @return string[]
	 */
	public static function missing( string $type, array $field, $value ): array {
		$value   = is_array( $value ) ? $value : array();
		$missing = array();
		foreach ( self::parts( $type, $field ) as $part ) {
			if ( $part['optional'] || $part['data'] ) {
				continue;
			}
			$v = $value[ $part['value'] ] ?? null;
			if ( ( null === $v || '' === $v ) && null !== $part['alias'] ) {
				$v = $value[ $part['alias'] ] ?? null;
			}
			if ( ! is_scalar( $v ) || '' === trim( (string) $v ) ) {
				$missing[] = $part['value'];
			}
		}
		return $missing;
	}
}
