<?php
/**
 * Repairs for saved schemas whose structure older builds got wrong.
 *
 * @package SubtleForms\Support
 * @since   2.3.1
 */

declare(strict_types=1);

namespace SubtleForms\Support;

/**
 * Structural repairs applied when a schema is served or copied.
 */
final class SchemaRepair {

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
