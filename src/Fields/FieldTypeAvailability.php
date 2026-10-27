<?php
/**
 * Which field types a saved form uses that nothing registers right now.
 *
 * Add-ons register their own field types on `subtleforms/fields/register`.
 * A form keeps a field whose type is not registered (for example after the
 * add-on that provided it was deactivated), so nothing is lost, but the live
 * form does not show it. This class reads only the field type registry; it
 * holds no list of add-on field types.
 *
 * @package SubtleForms\Fields
 * @since   2.3.9
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class FieldTypeAvailability {

	/**
	 * Types this plugin shipped in earlier versions and still reads. A saved
	 * form that uses one keeps working while nothing registers it: the field is
	 * left out of the live form and the form stays open.
	 */
	const LEGACY_TYPES = array( 'signature', 'calculation' );

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
	 * Add-on field types that hold no answer (they show something, such as a
	 * summary, but the visitor answers nothing). Entries, emails, webhooks
	 * and the "has an input field" check leave them out.
	 *
	 * @return string[]
	 */
	public static function noAnswerTypes(): array {
		if ( ! function_exists( 'apply_filters' ) ) {
			return array();
		}
		/**
		 * Add-on field types that hold no answer.
		 *
		 * @param string[] $types Field types.
		 * @since 2.7.2
		 */
		return array_values( array_filter( (array) apply_filters( 'subtleforms/fields/no_answer_types', array() ), 'is_string' ) );
	}

	/**
	 * What the builder needs to know about field types an add-on registered,
	 * from the `meta` of their definitions: `noMessages` (no required or
	 * error messages), `logicOnly` (shown or hidden by logic but takes no
	 * answer), `notInRepeater` (cannot go inside a Repeater), plus
	 * `noAnswer` for the types in noAnswerTypes().
	 *
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 * @return array<string,array<string,bool>> Type to flags.
	 */
	public static function typeFlags( ?FieldRegistry $registry = null ): array {
		$registry = self::registry( $registry );
		$out      = array();
		if ( $registry instanceof FieldRegistry ) {
			foreach ( $registry->all() as $type => $definition ) {
				$meta = is_array( $definition->meta ?? null ) ? $definition->meta : array();
				foreach ( array( 'noMessages', 'logicOnly', 'notInRepeater' ) as $flag ) {
					if ( ! empty( $meta[ $flag ] ) ) {
						$out[ (string) $type ][ $flag ] = true;
					}
				}
			}
		}
		foreach ( self::noAnswerTypes() as $type ) {
			$out[ $type ]['noAnswer'] = true;
		}
		return $out;
	}

	/**
	 * Field types a form may use and this site understands: every registered
	 * type (this plugin's and any add-on's), the types this plugin reads
	 * through a fallback, and the older names its schema check accepts.
	 *
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 * @return string[]
	 */
	public static function knownTypes( ?FieldRegistry $registry = null ): array {
		$registry = self::registry( $registry );
		$types    = array_merge( \SubtleForms\Support\SchemaValidator::CORE_TYPES, self::FALLBACKS );
		if ( $registry instanceof FieldRegistry ) {
			$types = array_merge( $types, array_map( 'strval', array_keys( $registry->all() ) ) );
		}
		return array_values( array_unique( $types ) );
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
		$registry = self::registry( $registry );
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
	 * The field registry (null when the plugin is not booted).
	 *
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 */
	private static function registry( ?FieldRegistry $registry = null ): ?FieldRegistry {
		if ( null !== $registry ) {
			return $registry;
		}
		try {
			$found = \SubtleForms\Plugin::instance()->container()->get( FieldRegistry::class );
		} catch ( \Throwable $e ) {
			return null;
		}
		return $found instanceof FieldRegistry ? $found : null;
	}

	/**
	 * Field types a schema uses that nothing registers right now.
	 *
	 * @param mixed              $schema   Form schema (the `schema` part of a version row).
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 * @return string[]
	 */
	public static function unregistered( $schema, ?FieldRegistry $registry = null ): array {
		if ( ! is_array( $schema ) ) {
			return array();
		}
		$registry = self::registry( $registry );
		if ( ! $registry instanceof FieldRegistry ) {
			return array();
		}
		$known = array_flip( self::knownTypes( $registry ) );
		$out   = array();
		foreach ( \SubtleForms\Support\SchemaFields::flat( $schema ) as $field ) {
			$type = $field['type'] ?? '';
			if ( is_string( $type ) && '' !== $type && ! isset( $known[ $type ] ) ) {
				$out[ $type ] = true;
			}
		}
		return array_keys( $out );
	}

	/**
	 * Whether a saved form is not available to visitors: it holds a field whose
	 * type nothing registers. Such a form cannot work as its author built it,
	 * so it is not shown and does not accept entries until a plugin that
	 * registers the type is active again. The form itself is kept as saved.
	 * Settings stored in the schema are not looked at; only registered field
	 * types decide.
	 *
	 * @param mixed              $schema   Form schema.
	 * @param FieldRegistry|null $registry Registry (null: the plugin's own).
	 */
	public static function closesForm( $schema, ?FieldRegistry $registry = null ): bool {
		return (bool) array_diff( self::unregistered( $schema, $registry ), self::LEGACY_TYPES );
	}

	/**
	 * Remove fields nothing registers from the schema sent to visitors.
	 *
	 * @param mixed $schema Public schema.
	 * @return mixed
	 */
	public static function filterPublicSchema( $schema ) {
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $schema;
		}
		$missing = self::unregistered( $schema );
		if ( empty( $missing ) ) {
			return $schema;
		}
		$schema['fields'] = self::strip( $schema['fields'], $missing );
		return $schema;
	}

	/**
	 * Drop answers to fields nothing registers: the live form does not show
	 * them, so a value can only come from a crafted request.
	 *
	 * @param array $payload Submitted values.
	 * @param mixed $schema  Form schema.
	 * @return array
	 */
	public static function dropMissingAnswers( array $payload, $schema ): array {
		$missing = self::unregistered( $schema );
		if ( ! $missing ) {
			return $payload;
		}
		foreach ( \SubtleForms\Support\SchemaFields::flat( $schema ) as $field ) {
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
