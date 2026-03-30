<?php
/**
 * SubtleForms Field Registry
 *
 * @package SubtleForms\Fields
 * @since   0.1.0
 */

namespace SubtleForms\Fields;

use InvalidArgumentException;

/**
 * Central registry for field definitions.
 */
final class FieldRegistry {

	/**
	 * @var array<string, FieldDefinition>
	 */
	private array $fields = array();

	/**
	 * Register a field definition.
	 *
	 * @param FieldDefinition $definition
	 * @return void
	 * @throws InvalidArgumentException If field type is already registered
	 */
	public function register( FieldDefinition $definition ): void {
		if ( isset( $this->fields[ $definition->type ] ) ) {
			throw new InvalidArgumentException(
				sprintf( 'Field type "%s" is already registered.', $definition->type )
			);
		}

		$this->fields[ $definition->type ] = $definition;
	}

	/**
	 * Get a field definition by type.
	 *
	 * @param string $type
	 * @return FieldDefinition|null
	 */
	public function get( string $type ): ?FieldDefinition {
		return $this->fields[ $type ] ?? null;
	}

	/**
	 * Get all registered field definitions.
	 *
	 * @return array<string, FieldDefinition>
	 */
	public function all(): array {
		return $this->fields;
	}

	/**
	 * Get fields grouped by category.
	 *
	 * @return array<string, array<FieldDefinition>>
	 */
	public function byCategory(): array {
		$grouped = array();

		foreach ( $this->fields as $field ) {
			// Skip palette-hidden (internal/system) fields
			if ( $field->paletteHidden ) {
				continue;
			}

			$category = $field->category;
			if ( ! isset( $grouped[ $category ] ) ) {
				$grouped[ $category ] = array();
			}
			$grouped[ $category ][] = $field;
		}

		return $grouped;
	}

	/**
	 * Check if a field type exists.
	 *
	 * @param string $type
	 * @return bool
	 */
	public function has( string $type ): bool {
		return isset( $this->fields[ $type ] );
	}

	/**
	 * Get all field definitions as array representation.
	 *
	 * @return array
	 */
	public function toArray(): array {
		return array_map( fn( $field ) => $field->toArray(), $this->fields );
	}
}
