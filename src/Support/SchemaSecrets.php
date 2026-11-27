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

	/** Flag that tells the builder a secret key is saved without sending it. */
	const SET_FLAG = 'secret_key_set';

	/**
	 * Seal every field secret key in a schema. Sealed and empty values stay as they are.
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function seal( array $schema ): array {
		return self::map(
			$schema,
			static function ( array $node ): array {
				unset( $node[ self::SET_FLAG ] );
				if ( isset( $node['secret_key'] ) && is_string( $node['secret_key'] ) ) {
					$node['secret_key'] = SecretBox::seal( $node['secret_key'] );
				}
				return $node;
			}
		);
	}

	/**
	 * Remove every field secret key from a schema (for exports).
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function strip( array $schema ): array {
		return self::map(
			$schema,
			static function ( array $node ): array {
				unset( $node['secret_key'], $node[ self::SET_FLAG ] );
				return $node;
			}
		);
	}

	/**
	 * What the builder gets: a saved secret key becomes an empty value plus
	 * `secret_key_set: true`. The stored (sealed) text never leaves the server.
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function hide( array $schema ): array {
		return self::map(
			$schema,
			static function ( array $node ): array {
				if ( isset( $node['secret_key'] ) && is_string( $node['secret_key'] ) && '' !== $node['secret_key'] ) {
					$node['secret_key']      = '';
					$node[ self::SET_FLAG ] = true;
				}
				return $node;
			}
		);
	}

	/**
	 * Before a save: a field whose secret key came back empty keeps the one
	 * already stored for the same field; a new value replaces it.
	 *
	 * @param array $schema Schema being saved.
	 * @param array $stored Schema stored now (draft, else published).
	 * @return array
	 */
	public static function keep( array $schema, array $stored ): array {
		$saved = array();
		self::map(
			$stored,
			static function ( array $node, array $field ) use ( &$saved ): array {
				$id = self::identity( $field );
				if ( '' !== $id && isset( $node['secret_key'] ) && is_string( $node['secret_key'] ) && '' !== $node['secret_key'] ) {
					$saved[ $id ][ $node === $field ? 'field' : 'config' ] = $node['secret_key'];
				}
				return $node;
			}
		);
		if ( ! $saved ) {
			return $schema;
		}
		return self::map(
			$schema,
			static function ( array $node, array $field ) use ( $saved ): array {
				$where = $node === $field ? 'field' : 'config';
				unset( $node[ self::SET_FLAG ] );
				$id = self::identity( $field );
				if ( isset( $saved[ $id ][ $where ] ) && ( ! isset( $node['secret_key'] ) || '' === $node['secret_key'] ) ) {
					$node['secret_key'] = $saved[ $id ][ $where ];
				}
				return $node;
			}
		);
	}

	/**
	 * A form row as the admin REST route sends it: its saved schemas
	 * (`config` and `draft_schema`) with secret keys hidden.
	 *
	 * @param array $form Form row.
	 * @return array
	 */
	public static function hideInRow( array $form ): array {
		if ( isset( $form['config'] ) && is_array( $form['config'] ) ) {
			$form['config'] = self::hide( $form['config'] );
		}
		if ( isset( $form['draft_schema'] ) && is_string( $form['draft_schema'] ) && '' !== $form['draft_schema'] ) {
			$draft = json_decode( $form['draft_schema'], true );
			if ( is_array( $draft ) ) {
				$form['draft_schema'] = (string) wp_json_encode( self::hide( $draft ) );
			}
		}
		return $form;
	}

	/**
	 * @param array $field Field.
	 */
	private static function identity( array $field ): string {
		$id = $field['id'] ?? ( $field['key'] ?? '' );
		return is_string( $id ) || is_int( $id ) ? (string) $id : '';
	}

	/**
	 * @param array    $schema Schema.
	 * @param callable $change Gets a field, then its config, plus the field; returns the node.
	 * @return array
	 */
	private static function map( array $schema, callable $change ): array {
		if ( isset( $schema['fields'] ) && is_array( $schema['fields'] ) ) {
			$schema['fields'] = self::fields( $schema['fields'], $change );
		}
		return $schema;
	}

	/**
	 * @param array    $fields Field list.
	 * @param callable $change Node callback.
	 * @return array
	 */
	private static function fields( array $fields, callable $change ): array {
		foreach ( $fields as $i => $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$original = $field;
			$field    = $change( $field, $original );
			if ( isset( $field['config'] ) && is_array( $field['config'] ) ) {
				$field['config'] = $change( $field['config'], $original );
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
}
