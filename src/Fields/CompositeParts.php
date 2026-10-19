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
	 * Whether a type is made of parts.
	 */
	public static function has( string $type ): bool {
		return isset( self::PARTS[ $type ] );
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
		$defs = self::PARTS[ $type ] ?? null;
		if ( null === $defs || ! is_array( $fields ) || array() === $fields ) {
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
	 * @return array<int,array{part:string,value:string,alias:?string,optional:bool}>
	 */
	public static function parts( string $type, array $field ): array {
		$defs = self::PARTS[ $type ] ?? array();
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
			if ( $part['optional'] ) {
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
