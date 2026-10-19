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
