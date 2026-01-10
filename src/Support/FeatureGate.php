<?php
/**
 * SubtleForms Feature Gate
 *
 * @package SubtleForms\Support
 * @since   0.1.0
 */

namespace SubtleForms\Support;

use RuntimeException;

/**
 * Helper to enforce capabilities.
 */
final class FeatureGate {

	/**
	 * @var Capabilities
	 */
	private $caps;

	/**
	 * @param Capabilities $caps
	 */
	public function __construct( $caps ) {
		$this->caps = $caps;
	}

	/**
	 * Check if a capability is allowed.
	 */
	public function allows( string $capability ) {
		return $this->caps->allows( $capability );
	}

	/**
	 * Enforce a capability or throw.
	 *
	 * @throws RuntimeException
	 */
	public function require( string $capability, string $message = '' ) {
		if ( $this->allows( $capability ) ) {
			return;
		}

		throw new RuntimeException( $message ?: sprintf( 'Capability "%s" is not available.', $capability ) );
	}
}
