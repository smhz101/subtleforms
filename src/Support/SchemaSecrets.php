<?php
/**
 * The secret key a CAPTCHA field keeps in the form's schema.
 *
 * It is sealed when the schema is saved, opened only on the server where a
 * visitor's answer is checked, and left out of exports.
 *
 * @package SubtleForms\Support
 * @since   2.12.0
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SchemaSecrets {

	/**
	 * Seal every field secret key in a schema. Sealed and empty values stay as they are.
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function seal( array $schema ): array {
		return self::map( $schema, array( SecretBox::class, 'seal' ) );
	}

	/**
	 * Remove every field secret key from a schema (for exports).
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function strip( array $schema ): array {
		return self::map( $schema, null );
	}

	/**
	 * @param array         $schema Schema.
	 * @param callable|null $change Applied to each secret; null removes it.
	 * @return array
	 */
	private static function map( array $schema, ?callable $change ): array {
		if ( isset( $schema['fields'] ) && is_array( $schema['fields'] ) ) {
			$schema['fields'] = self::fields( $schema['fields'], $change );
		}
		return $schema;
	}

	/**
	 * @param array         $fields Field list.
	 * @param callable|null $change Applied to each secret; null removes it.
	 * @return array
	 */
	private static function fields( array $fields, ?callable $change ): array {
		foreach ( $fields as $i => $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$field = self::one( $field, $change );
			if ( isset( $field['config'] ) && is_array( $field['config'] ) ) {
				$field['config'] = self::one( $field['config'], $change );
			}
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) ) {
					$field[ $child ] = self::fields( $field[ $child ], $change );
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $c => $column ) {
					if ( ! is_array( $column ) ) {
						continue;
					}
					$key                    = isset( $column['fields'] ) ? 'fields' : ( isset( $column['children'] ) ? 'children' : '' );
					$field['columns'][ $c ] = '' === $key ? self::fields( $column, $change ) : array_merge( $column, array( $key => self::fields( (array) $column[ $key ], $change ) ) );
				}
			}
			$fields[ $i ] = $field;
		}
		return $fields;
	}

	/**
	 * @param array         $node   Field or its config.
	 * @param callable|null $change Applied to the secret; null removes it.
	 * @return array
	 */
	private static function one( array $node, ?callable $change ): array {
		if ( ! array_key_exists( 'secret_key', $node ) ) {
			return $node;
		}
		if ( null === $change ) {
			unset( $node['secret_key'] );
		} elseif ( is_string( $node['secret_key'] ) ) {
			$node['secret_key'] = $change( $node['secret_key'] );
		}
		return $node;
	}
}
