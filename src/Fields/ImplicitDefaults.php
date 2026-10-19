<?php
/**
 * Values a visitor never typed, but the field already shows.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Fields;


if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Fills color defaults before validation and save (FA-06).
 */
final class ImplicitDefaults {
	/**
	 * @param array<string, mixed> $schema  Form schema.
	 * @param array<string, mixed> $payload Submitted values.
	 * @return array<string, mixed>
	 */
	public static function apply( array $schema, array $payload ): array {
		$fields = $schema['fields'] ?? array();
		if ( ! is_array( $fields ) ) {
			return $payload;
		}
		self::walk( $fields, $payload );
		return $payload;
	}

	/**
	 * @param array<int, mixed>    $fields  Field nodes.
	 * @param array<string, mixed> $payload Values, by reference.
	 * @return void
	 */
	private static function walk( array $fields, array &$payload ): void {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$key = $field['key'] ?? ( $field['config']['key'] ?? '' );
			if ( 'color_picker' === ( $field['type'] ?? '' ) && is_string( $key ) && '' !== $key ) {
				$current = $payload[ $key ] ?? '';
				if ( '' === $current || null === $current ) {
					$default = $field['default'] ?? ( $field['config']['default'] ?? ( $field['config']['defaultValue'] ?? '' ) );
					if ( is_string( $default ) && '' !== $default ) {
						$payload[ $key ] = $default;
					}
				}
			}
			foreach ( array( 'children', 'fields' ) as $child_key ) {
				if ( isset( $field[ $child_key ] ) && is_array( $field[ $child_key ] ) ) {
					self::walk( $field[ $child_key ], $payload );
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) && array_is_list( $column ) ) {
						self::walk( $column, $payload );
					} elseif ( is_array( $column ) ) {
						$nested = $column['fields'] ?? ( $column['children'] ?? array() );
						if ( is_array( $nested ) ) {
							self::walk( $nested, $payload );
						}
					}
				}
			}
		}
	}
}
