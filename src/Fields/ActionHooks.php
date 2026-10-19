<?php
/**
 * Action Hook fields.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Fields;


if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Fires the hook named on an Action Hook field when the form renders or is submitted (FA-14).
 */
final class ActionHooks {
	/**
	 * Sanitized hook names on the form.
	 *
	 * @param array<string, mixed> $schema Schema.
	 * @return string[]
	 */
	public static function names( array $schema ): array {
		$found = array();
		self::walk( $schema['fields'] ?? array(), $found );
		return array_values( array_unique( $found ) );
	}

	/**
	 * @param array<string, mixed> $schema  Schema.
	 * @param array<string, mixed> $context Extra arguments passed to the hook.
	 * @return void
	 */
	public static function fire( array $schema, array $context = array() ): void {
		foreach ( self::names( $schema ) as $name ) {
			do_action( $name, $context );
		}
	}

	/**
	 * @param mixed    $fields Field nodes.
	 * @param string[] $found  Names.
	 * @return void
	 */
	private static function walk( $fields, array &$found ): void {
		if ( ! is_array( $fields ) ) {
			return;
		}
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( 'action_hook' === ( $field['type'] ?? '' ) ) {
				$raw  = $field['hook_name'] ?? ( $field['config']['hook_name'] ?? '' );
				$name = is_string( $raw ) ? sanitize_key( $raw ) : '';
				if ( '' !== $name ) {
					$found[] = $name;
				}
			}
			foreach ( array( 'children', 'fields' ) as $child_key ) {
				if ( isset( $field[ $child_key ] ) ) {
					self::walk( $field[ $child_key ], $found );
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) && array_is_list( $column ) ) {
						self::walk( $column, $found );
					} elseif ( is_array( $column ) ) {
						self::walk( $column['fields'] ?? ( $column['children'] ?? array() ), $found );
					}
				}
			}
		}
	}
}
