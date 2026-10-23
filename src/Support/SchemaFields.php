<?php
/**
 * Flat list of the fields in a form schema.
 *
 * @package SubtleForms\Support
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Walks a schema's field tree (steps, groups, columns) once.
 */
final class SchemaFields {

	/**
	 * Every field in a schema, flattened, with the field's config merged onto
	 * the node.
	 *
	 * @param mixed $schema Form schema.
	 * @return array<int, array>
	 */
	public static function flat( $schema ): array {
		$out = array();
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $out;
		}
		$walk = static function ( array $fields ) use ( &$walk, &$out ) {
			foreach ( $fields as $field ) {
				if ( ! is_array( $field ) ) {
					continue;
				}
				$config = isset( $field['config'] ) && is_array( $field['config'] ) ? array_merge( $field, $field['config'] ) : $field;
				$out[]  = $config;
				foreach ( array( 'fields', 'children' ) as $nested ) {
					if ( ! empty( $field[ $nested ] ) && is_array( $field[ $nested ] ) ) {
						$walk( $field[ $nested ] );
					}
				}
				if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
					foreach ( $field['columns'] as $column ) {
						if ( ! is_array( $column ) ) {
							continue;
						}
						if ( isset( $column['fields'] ) && is_array( $column['fields'] ) ) {
							$walk( $column['fields'] );
						} elseif ( isset( $column['children'] ) && is_array( $column['children'] ) ) {
							$walk( $column['children'] );
						} else {
							$walk( $column );
						}
					}
				}
			}
		};
		$walk( $schema['fields'] );
		return $out;
	}
}
