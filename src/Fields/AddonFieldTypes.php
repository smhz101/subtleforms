<?php
/**
 * Field types that add-ons provide.
 *
 * Signature, Calculation and Card Payment fields are registered by SubtleForms
 * Pro. A form keeps such fields when the add-on is not active, so nothing is
 * lost, but the live form leaves them out until the add-on is back.
 *
 * @package SubtleForms\Fields
 * @since   2.3.9
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class AddonFieldTypes {

	/**
	 * Field types this plugin knows belong to add-ons.
	 */
	const TYPES = array( 'signature', 'calculation', 'payment_card' );

	/**
	 * Field types an add-on provides that still work without it, as a plain
	 * choice: a Picture Choice field shows its labels as radio buttons (or
	 * checkboxes when several are allowed) and its images are left out. The
	 * form is not stripped of them and saved forms keep every key.
	 */
	const FALLBACKS = array( 'picture_choice' );

	/**
	 * Register hooks.
	 */
	public static function register(): void {
		add_filter( 'subtleforms/public_schema', array( self::class, 'filterPublicSchema' ), 5 );
	}

	/**
	 * Add-on field types, filterable so other add-ons can declare theirs.
	 *
	 * @return string[]
	 */
	public static function types(): array {
		/**
		 * Field types that only exist while an add-on registers them.
		 *
		 * @since 2.3.9
		 *
		 * @param string[] $types Field types.
		 */
		return array_values( array_filter( (array) apply_filters( 'subtleforms/fields/addon_types', self::TYPES ), 'is_string' ) );
	}

	/**
	 * Types a saved form may contain: add-on types plus those with a fallback.
	 *
	 * @return string[]
	 */
	public static function knownTypes(): array {
		return array_values( array_unique( array_merge( self::types(), self::FALLBACKS ) ) );
	}

	/**
	 * The type a field is checked and drawn as. A field type with a fallback
	 * whose add-on is not active is a plain choice; every other type is itself.
	 *
	 * @param string             $type     Field type.
	 * @param array              $field    Field node, for the "allow several" setting.
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 * @return string The type, or radio / multiple_choice for a fallback.
	 */
	public static function effectiveType( string $type, array $field = array(), ?FieldRegistry $registry = null ): string {
		if ( ! in_array( $type, self::FALLBACKS, true ) ) {
			return $type;
		}
		if ( null === $registry ) {
			try {
				$registry = \SubtleForms\Plugin::instance()->container()->get( FieldRegistry::class );
			} catch ( \Throwable $e ) {
				$registry = null;
			}
		}
		if ( $registry instanceof FieldRegistry && $registry->has( $type ) ) {
			return $type;
		}
		$config   = isset( $field['config'] ) && is_array( $field['config'] ) ? $field['config'] : array();
		$multiple = $field['allowMultiple'] ?? $config['allowMultiple'] ?? false;
		return true === $multiple ? 'multiple_choice' : 'radio';
	}

	/**
	 * The type the server checks an answer as. A field type with a fallback
	 * is always checked as the plain choice, with or without its add-on: the
	 * rules are the same, only the look differs.
	 *
	 * @param string $type  Field type.
	 * @param array  $field Field node, for the "allow several" setting.
	 * @return string The type, or radio / multiple_choice for a fallback.
	 */
	public static function validationType( string $type, array $field = array() ): string {
		if ( ! in_array( $type, self::FALLBACKS, true ) ) {
			return $type;
		}
		$config   = isset( $field['config'] ) && is_array( $field['config'] ) ? $field['config'] : array();
		$multiple = $field['allowMultiple'] ?? $config['allowMultiple'] ?? false;
		return true === $multiple ? 'multiple_choice' : 'radio';
	}

	/**
	 * Add-on types that no active plugin registers right now.
	 *
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 * @return string[]
	 */
	public static function missing( ?FieldRegistry $registry = null ): array {
		if ( null === $registry ) {
			try {
				$registry = \SubtleForms\Plugin::instance()->container()->get( FieldRegistry::class );
			} catch ( \Throwable $e ) {
				return array();
			}
		}
		if ( ! $registry instanceof FieldRegistry ) {
			return array();
		}
		return array_values(
			array_filter(
				self::types(),
				static function ( $type ) use ( $registry ) {
					return ! $registry->has( $type );
				}
			)
		);
	}

	/**
	 * Remove fields whose add-on is not active from the schema sent to visitors.
	 *
	 * @param mixed $schema Public schema.
	 * @return mixed
	 */
	public static function filterPublicSchema( $schema ) {
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $schema;
		}
		$missing = self::missing();
		if ( empty( $missing ) ) {
			return $schema;
		}
		$schema['fields'] = self::strip( $schema['fields'], $missing );
		return $schema;
	}

	/**
	 * Drop answers to fields whose add-on is not active: the live form does
	 * not show them, so a value can only come from a crafted request.
	 *
	 * @param array $payload Submitted values.
	 * @param mixed $schema  Form schema.
	 * @return array
	 */
	public static function dropMissingAnswers( array $payload, $schema ): array {
		$missing = self::missing();
		if ( ! $missing || ! is_array( $schema ) ) {
			return $payload;
		}
		foreach ( \SubtleForms\Payments\Pricing::fields( $schema ) as $field ) {
			if ( in_array( (string) ( $field['type'] ?? '' ), $missing, true ) && ! empty( $field['key'] ) ) {
				unset( $payload[ (string) $field['key'] ] );
			}
		}
		return $payload;
	}

	/**
	 * Remove nodes of the given types, at any depth.
	 *
	 * @param array    $nodes Field nodes.
	 * @param string[] $types Types to remove.
	 * @return array
	 */
	public static function strip( array $nodes, array $types ): array {
		$out = array();
		foreach ( $nodes as $index => $node ) {
			if ( is_array( $node ) && in_array( (string) ( $node['type'] ?? '' ), $types, true ) ) {
				continue;
			}
			if ( is_array( $node ) ) {
				foreach ( array( 'fields', 'children' ) as $nested ) {
					if ( isset( $node[ $nested ] ) && is_array( $node[ $nested ] ) ) {
						$node[ $nested ] = self::strip( $node[ $nested ], $types );
					}
				}
				if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
					foreach ( $node['columns'] as $c => $column ) {
						if ( ! is_array( $column ) ) {
							continue;
						}
						if ( isset( $column['fields'] ) && is_array( $column['fields'] ) ) {
							$node['columns'][ $c ]['fields'] = self::strip( $column['fields'], $types );
						} elseif ( isset( $column['children'] ) && is_array( $column['children'] ) ) {
							$node['columns'][ $c ]['children'] = self::strip( $column['children'], $types );
						} else {
							$node['columns'][ $c ] = self::strip( $column, $types );
						}
					}
				}
			}
			if ( is_int( $index ) ) {
				$out[] = $node;
			} else {
				$out[ $index ] = $node;
			}
		}
		return $out;
	}
}
