<?php
/**
 * Field types that add-ons provide.
 *
 * Some field types (for example Signature and Calculation) are registered by
 * an add-on. A form keeps such fields when the add-on is not active, so nothing is
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
	const TYPES = array( 'signature', 'calculation', 'payment_card', 'payment_product', 'payment_choice', 'payment_amount', 'payment_summary', 'payment_coupon', 'payment_hidden_price' );

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
		if ( null === $registry ) {
			try {
				$registry = \SubtleForms\Plugin::instance()->container()->get( FieldRegistry::class );
			} catch ( \Throwable $e ) {
				$registry = null;
			}
		}
		$out = array();
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
	 * Whether a schema takes a payment that nothing handles: it has a payment
	 * field nobody registers, or it was saved by an earlier version with
	 * payment settings turned on (`metadata.payment.enabled`) and nothing
	 * registers the Card Payment field. Without the add-on such a form cannot
	 * take its payment, so it is not shown and does not accept entries.
	 *
	 * @param mixed $schema Form schema (the `schema` part of a version row).
	 */
	public static function needsMissingPayment( $schema ): bool {
		if ( ! is_array( $schema ) ) {
			return false;
		}
		$isPayment = static function ( $type ) {
			return 0 === strpos( (string) $type, 'payment_' );
		};
		$missing   = array_filter( self::missing(), $isPayment );
		if ( ! $missing ) {
			return false;
		}
		$saved = $schema['metadata']['payment'] ?? null;
		if ( is_array( $saved ) && ! empty( $saved['enabled'] ) && in_array( 'payment_card', $missing, true ) ) {
			return true;
		}
		foreach ( \SubtleForms\Support\SchemaFields::flat( $schema ) as $field ) {
			if ( in_array( (string) ( $field['type'] ?? '' ), $missing, true ) ) {
				return true;
			}
		}
		return false;
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
