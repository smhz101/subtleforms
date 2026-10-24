<?php

/**
 * SubtleForms Feature Gate
 *
 * Reads the capability map (Support\Capabilities). Everything this plugin
 * ships is on by default and this plugin never switches its own code off
 * through the gate. Add-ons may add their own capability keys through the
 * `subtleforms/capabilities` filter and read them here for their own code.
 *
 * @package SubtleForms\Support
 * @since   0.1.0
 * @since   2.7.2 Capability map only. Add-ons decide for themselves which of
 *                their features are available.
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RuntimeException;

/**
 * Capability map lookup shared by the services in the container.
 */
final class FeatureGate {

	/**
	 * @var Capabilities
	 */
	private $caps;

	/**
	 * Older add-ons pass a second argument; it is ignored.
	 *
	 * @param Capabilities $caps Capability map.
	 */
	public function __construct( $caps ) {
		$this->caps = $caps;
	}

	/**
	 * Check if a capability is on in the map.
	 *
	 * @param string $capability Capability key from Capabilities::defaults() or an add-on.
	 * @return bool
	 */
	public function allows( string $capability ) {
		return $this->caps->allows( $capability );
	}

	/**
	 * Enforce a capability or throw.
	 *
	 * @param string $capability Capability key.
	 * @param string $message    Optional custom error message.
	 * @throws RuntimeException If capability is not available.
	 */
	public function require( string $capability, string $message = '' ) {
		if ( $this->allows( $capability ) ) {
			return;
		}

		throw new RuntimeException( $message ?: sprintf( 'Capability "%s" is not available.', $capability ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
	}

	/**
	 * Get the underlying Capabilities instance.
	 *
	 * @return Capabilities
	 */
	public function capabilities(): Capabilities {
		return $this->caps;
	}

	/**
	 * Swap the capability map this gate reads, for example after an add-on
	 * has added its `subtleforms/capabilities` filter.
	 *
	 * @since 2.7.1
	 *
	 * @param Capabilities $caps Capability map.
	 */
	public function setCapabilities( Capabilities $caps ): void {
		$this->caps = $caps;
	}
}
