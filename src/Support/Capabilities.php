<?php

/**
 * SubtleForms Capabilities Service.
 *
 * @package SubtleForms\Support
 * @since   0.1.0
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Capability map.
 *
 * - This plugin turns on every capability it reads (see defaults()).
 * - Add-ons add their own keys through the `subtleforms/capabilities` filter.
 * - Code asks "is this capability on?", never which plugins are active.
 */
final class Capabilities {
	/**
	 * Map before the filter.
	 *
	 * @var array<string,bool>
	 */
	private array $base;

	/**
	 * Map after the filter.
	 *
	 * @var array<string,bool>
	 */
	private array $map;

	/**
	 * Callbacks on the filter when $map was built.
	 *
	 * @var int
	 */
	private int $filterCount;

	/**
	 * @param array<string,bool> $defaults Optional capability overrides.
	 */
	public function __construct( array $defaults = array() ) {
		$this->base = $defaults ?: self::defaults();
		$this->build();
	}

	/**
	 * Apply the filter to the base map.
	 */
	private function build(): void {
		$this->filterCount = self::filterCount();
		$map               = apply_filters( 'subtleforms/capabilities', $this->base );
		$this->map         = is_array( $map ) ? $map : $this->base;
	}

	/**
	 * Number of callbacks on `subtleforms/capabilities`. An add-on that adds
	 * its filter after this map was built (they load after this plugin) is
	 * picked up on the next read.
	 *
	 * @return int
	 */
	private static function filterCount(): int {
		global $wp_filter;
		$hook = $wp_filter['subtleforms/capabilities'] ?? null;
		if ( ! is_object( $hook ) || ! isset( $hook->callbacks ) || ! is_array( $hook->callbacks ) ) {
			return 0;
		}
		$n = 0;
		foreach ( $hook->callbacks as $callbacks ) {
			$n += is_array( $callbacks ) ? count( $callbacks ) : 0;
		}
		return $n;
	}

	/**
	 * The filtered map, rebuilt when the filter has gained or lost callbacks.
	 *
	 * @return array<string,bool>
	 */
	private function current(): array {
		if ( self::filterCount() !== $this->filterCount ) {
			$this->build();
		}
		return $this->map;
	}

		/**
		 * Capability required to manage plugin settings and entries.
		 *
		 * @return string
		 */
	public function manage_cap() {
		return 'manage_options';
	}

	/**
	 * Default capabilities.
	 *
	 * @return array<string,bool>
	 */
	public static function defaults() {
		// Built-in keys, all on. This plugin never switches its own code off
		// through this map. Other keys belong to add-ons, which add them
		// through the `subtleforms/capabilities` filter and read them in
		// their own code; a missing key reads as false.
		return array(
			'forms.unlimited'            => true,

			'logic.conditional.basic'    => true,

			'actions.save'               => true,
			'actions.webhook'            => true,
			'actions.email'              => true,

			'api.read'                   => true,
			'api.write'                  => true,

			'submissions.export'         => true,
		);
	}

	/**
	 * Check if a capability is allowed.
	 */
	public function allows( string $capability ) {
		$map = $this->current();
		return (bool) ( $map[ $capability ] ?? false );
	}

	/**
	 * @return array<string,bool>
	 */
	public function all() {
		return $this->current();
	}
}
