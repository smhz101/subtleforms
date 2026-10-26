<?php

/**
 * Repairs for saved schemas whose structure older builds got wrong.
 *
 * @package SubtleForms\Support
 * @since   2.3.1
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Structural repairs applied when a schema is served or copied.
 */
final class SchemaRepair {

	/**
	 * Form types whose structure decides between Standard and Multi-step.
	 * Conversational (and any add-on type) keeps the type it was given.
	 *
	 * @var array<int,string>
	 */
	const STRUCTURAL_TYPES = array( '', 'regular', 'standard', 'multi-step', 'multistep', 'multi_step', 'sectioned', 'steps' );

	/**
	 * Turn single checkboxes that carry a list of options into Multiple
	 * choice fields (pick any), anywhere in the tree.
	 *
	 * The builder does the same when it loads such a field (2.2.1), but a
	 * schema sent straight to the server (a template, an import, an add-on)
	 * was refused by SchemaValidator, which left an empty form behind (2.3.2).
	 *
	 * @param array $fields Field list.
	 * @return array{0: array, 1: int} The list and the number of fields converted.
	 */
	public static function checkboxListsToMultipleChoice( array $fields ): array {
		$count = 0;
		foreach ( $fields as $i => $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( ( $field['type'] ?? '' ) === 'checkbox' ) {
				$options = $field['options'] ?? ( $field['config']['options'] ?? null );
				if ( is_array( $options ) && count( $options ) > 0 ) {
					$field['type']          = 'multiple_choice';
					$field['allowMultiple'] = true;
					unset( $field['checkboxLabel'] );
					if ( isset( $field['config'] ) && is_array( $field['config'] ) ) {
						$field['config']['type'] = 'multiple_choice';
						unset( $field['config']['checkboxLabel'] );
					}
					++$count;
				}
			}
			foreach ( array( 'children', 'fields' ) as $childKey ) {
				if ( isset( $field[ $childKey ] ) && is_array( $field[ $childKey ] ) ) {
					list( $field[ $childKey ], $n ) = self::checkboxListsToMultipleChoice( $field[ $childKey ] );
					$count                         += $n;
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $c => $column ) {
					if ( is_array( $column ) ) {
						list( $field['columns'][ $c ], $n ) = self::checkboxListsToMultipleChoice( $column );
						$count                             += $n;
					}
				}
			}
			$fields[ $i ] = $field;
		}
		return array( $fields, $count );
	}

	/**
	 * Whether a field list has a Page Break (step) at root level.
	 *
	 * @param mixed $fields Field list.
	 * @return bool
	 */
	public static function hasSteps( $fields ): bool {
		if ( ! is_array( $fields ) ) {
			return false;
		}
		foreach ( $fields as $field ) {
			if ( is_array( $field ) && in_array( $field['type'] ?? '', array( 'step', 'form_step' ), true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * The form type its structure gives (2.3.2): a Standard form with a Page
	 * Break is Multi-step, a Multi-step form without one is Standard.
	 * Conversational and other types are returned unchanged.
	 *
	 * @param array $schema Schema with `metadata.type` and `fields`.
	 * @return string
	 */
	public static function structuralType( array $schema ): string {
		$raw = isset( $schema['metadata']['type'] ) && is_string( $schema['metadata']['type'] ) ? $schema['metadata']['type'] : '';
		if ( ! in_array( strtolower( $raw ), self::STRUCTURAL_TYPES, true ) ) {
			return $raw;
		}
		return self::hasSteps( $schema['fields'] ?? array() ) ? FormMeta::TYPE_MULTI_STEP : FormMeta::TYPE_STANDARD;
	}

	/**
	 * Set `metadata.type` from the structure (see structuralType()).
	 *
	 * @param array $schema Schema.
	 * @return array{0: array, 1: bool} The schema and whether the type changed.
	 */
	public static function syncType( array $schema ): array {
		$type    = self::structuralType( $schema );
		$current = $schema['metadata']['type'] ?? null;
		if ( $type === $current || ( '' === $type && null === $current ) ) {
			return array( $schema, false );
		}
		if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$schema['metadata'] = array();
		}
		$schema['metadata']['type'] = $type;
		return array( $schema, true );
	}

	/**
	 * Move root-level fields of a multi-step form into its first step.
	 *
	 * Builds before 2.3.1 added a Page Break as an empty step after the
	 * existing fields, leaving those fields outside every step: the builder
	 * hid them and the live form never showed them (QA-08). Fields before the
	 * first step go to the start of that step and fields after it to its end;
	 * order, keys and settings are kept.
	 *
	 * @param array $schema Schema with a `fields` list.
	 * @return array{0: array, 1: int} The schema and the number of fields moved.
	 */
	public static function moveOrphansIntoFirstStep( array $schema ): array {
		$fields = $schema['fields'] ?? null;
		if ( ! is_array( $fields ) || ! $fields ) {
			return array( $schema, 0 );
		}

		$firstStep = null;
		foreach ( $fields as $index => $field ) {
			if ( is_array( $field ) && ( $field['type'] ?? '' ) === 'step' ) {
				$firstStep = $index;
				break;
			}
		}
		if ( null === $firstStep ) {
			return array( $schema, 0 );
		}

		$before = array();
		$after  = array();
		$steps  = array();
		foreach ( $fields as $index => $field ) {
			if ( is_array( $field ) && ( $field['type'] ?? '' ) === 'step' ) {
				$steps[] = $field;
			} elseif ( $index < $firstStep ) {
				$before[] = $field;
			} else {
				$after[] = $field;
			}
		}

		$moved = count( $before ) + count( $after );
		if ( 0 === $moved ) {
			return array( $schema, 0 );
		}

		// Steps keep their children under `children` (legacy: `fields`).
		$childKey = isset( $steps[0]['children'] ) || ! isset( $steps[0]['fields'] ) || ! is_array( $steps[0]['fields'] ) ? 'children' : 'fields';
		$existing = is_array( $steps[0][ $childKey ] ?? null ) ? $steps[0][ $childKey ] : array();

		$steps[0][ $childKey ] = array_values( array_merge( $before, $existing, $after ) );
		$schema['fields']      = $steps;

		return array( $schema, $moved );
	}

	/**
	 * Give every answer-bearing field that has no key one (RCOMPAT-02).
	 *
	 * A field without a key has nowhere to keep an answer and stopped the form
	 * from loading. The key comes from the field's id when that is a valid,
	 * unused key, else it is made the way the builder makes one:
	 * `<type>_<8 characters>`. Layout nodes (headings, dividers, steps,
	 * containers) may have no key and are left alone below the top level; the
	 * top level always needs one.
	 *
	 * @param array $schema Schema with a `fields` list.
	 * @return array{0: array, 1: int} The schema and the number of keys added.
	 */
	public static function assignMissingKeys( array $schema ): array {
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return array( $schema, 0 );
		}
		$used = array();
		self::collectKeys( $schema['fields'], $used );
		$count            = 0;
		$schema['fields'] = self::fillKeys( $schema['fields'], true, $used, $count );
		return array( $schema, $count );
	}

	/**
	 * Every key in a field tree.
	 *
	 * @param array $list Field list.
	 * @param array $used Keys found, by reference.
	 */
	private static function collectKeys( array $list, array &$used ): void {
		foreach ( $list as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			foreach ( array( $node['key'] ?? null, $node['config']['key'] ?? null ) as $key ) {
				if ( is_string( $key ) && '' !== $key ) {
					$used[ $key ] = true;
				}
			}
			foreach ( self::childLists( $node ) as $child ) {
				self::collectKeys( $child, $used );
			}
		}
	}

	/**
	 * The lists of fields a node holds.
	 *
	 * @param array $node Field node.
	 * @return array<int,array> Lists.
	 */
	private static function childLists( array $node ): array {
		$lists = array();
		foreach ( array( 'fields', 'children' ) as $name ) {
			if ( isset( $node[ $name ] ) && is_array( $node[ $name ] ) ) {
				$lists[] = $node[ $name ];
			}
		}
		if ( isset( $node['config']['children'] ) && is_array( $node['config']['children'] ) ) {
			$lists[] = $node['config']['children'];
		}
		foreach ( (array) ( $node['columns'] ?? array() ) as $column ) {
			if ( ! is_array( $column ) ) {
				continue;
			}
			if ( isset( $column['fields'] ) && is_array( $column['fields'] ) ) {
				$lists[] = $column['fields'];
			} elseif ( isset( $column['children'] ) && is_array( $column['children'] ) ) {
				$lists[] = $column['children'];
			} elseif ( isset( $column[0] ) && is_array( $column[0] ) ) {
				$lists[] = $column;
			}
		}
		return $lists;
	}

	/**
	 * Add missing keys to a field list and everything below it.
	 *
	 * @param array $list     Field list.
	 * @param bool  $topLevel Whether this is the root list.
	 * @param array $used     Keys in use, by reference.
	 * @param int   $count    Keys added, by reference.
	 * @return array
	 */
	private static function fillKeys( array $list, bool $topLevel, array &$used, int &$count ): array {
		foreach ( $list as $i => $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$has = ( isset( $node['key'] ) && is_string( $node['key'] ) && '' !== $node['key'] );
			if ( ! $has ) {
				$type = (string) ( $node['type'] ?? '' );
				$own  = $node['config']['key'] ?? null;
				if ( is_string( $own ) && '' !== $own ) {
					$node['key'] = $own;
				} elseif ( '' !== $type && ( $topLevel || ! FieldMapper::isLayoutType( $type ) ) ) {
					$node['key'] = self::newKey( $node, $type, $used );
					++$count;
				}
			}
			foreach ( array( 'fields', 'children' ) as $name ) {
				if ( isset( $node[ $name ] ) && is_array( $node[ $name ] ) ) {
					$node[ $name ] = self::fillKeys( $node[ $name ], false, $used, $count );
				}
			}
			if ( isset( $node['config']['children'] ) && is_array( $node['config']['children'] ) ) {
				$node['config']['children'] = self::fillKeys( $node['config']['children'], false, $used, $count );
			}
			if ( isset( $node['columns'] ) && is_array( $node['columns'] ) ) {
				foreach ( $node['columns'] as $c => $column ) {
					if ( ! is_array( $column ) ) {
						continue;
					}
					if ( isset( $column['fields'] ) && is_array( $column['fields'] ) ) {
						$node['columns'][ $c ]['fields'] = self::fillKeys( $column['fields'], false, $used, $count );
					} elseif ( isset( $column['children'] ) && is_array( $column['children'] ) ) {
						$node['columns'][ $c ]['children'] = self::fillKeys( $column['children'], false, $used, $count );
					} elseif ( isset( $column[0] ) && is_array( $column[0] ) ) {
						$node['columns'][ $c ] = self::fillKeys( $column, false, $used, $count );
					}
				}
			}
			$list[ $i ] = $node;
		}
		return $list;
	}

	/**
	 * A new unique key for a node: its id when usable, else `<type>_<hex>`.
	 *
	 * @param array  $node Field node.
	 * @param string $type Field type.
	 * @param array  $used Keys in use, by reference.
	 * @return string
	 */
	private static function newKey( array $node, string $type, array &$used ): string {
		$id = isset( $node['id'] ) && is_string( $node['id'] ) ? preg_replace( '/[^a-zA-Z0-9_-]/', '_', $node['id'] ) : '';
		if ( '' !== $id && preg_match( SchemaValidator::KEY_PATTERN, $id ) && ! isset( $used[ $id ] ) && ! RequestKeys::has( $id ) ) {
			$used[ $id ] = true;
			return $id;
		}
		$prefix = trim( (string) preg_replace( '/[^a-z0-9]+/', '_', strtolower( $type ) ), '_' );
		$prefix = '' === $prefix ? 'field' : substr( $prefix, 0, 24 );
		do {
			$key = $prefix . '_' . bin2hex( random_bytes( 4 ) );
		} while ( isset( $used[ $key ] ) );
		$used[ $key ] = true;
		return $key;
	}

	/**
	 * Apply every repair, logging what changed.
	 *
	 * @param array $schema Schema.
	 * @param int   $formId Form ID for the log line.
	 * @return array
	 */
	public static function repair( array $schema, int $formId = 0 ): array {
		list( $schema, $moved ) = self::moveOrphansIntoFirstStep( $schema );
		if ( $moved > 0 ) {
			Logger::warning( 'Form %d: moved %d field(s) that were outside every step into the first step.', $formId, $moved );
			/**
			 * Fires when a served schema had fields outside every step.
			 *
			 * @param int $formId Form ID.
			 * @param int $moved  Number of fields moved into the first step.
			 * @since 2.3.1
			 */
			do_action( 'subtleforms/schema/repaired_orphans', $formId, $moved );
		}
		return $schema;
	}
}
