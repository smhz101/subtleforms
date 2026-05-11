<?php
/**
 * SubtleForms Feature Gate
 *
 * Single entry point for both capability checks (freemium gate)
 * and license checks (Pro gate). The optional LicenseManager can
 * be injected when the licensing module is available.
 *
 * @package SubtleForms\Support
 * @since   0.1.0
 * @since   1.9.0 Merged Licensing\FeatureGate into this class.
 */

namespace SubtleForms\Support;

use SubtleForms\Contracts\LicenseManagerInterface;
use RuntimeException;

/**
 * Unified feature gate for capabilities and licensing.
 */
final class FeatureGate {

	/**
	 * @var Capabilities
	 */
	private $caps;

	/**
	 * @var LicenseManagerInterface|null
	 */
	private $licenseManager;

	/**
	 * @param Capabilities                 $caps           Capability map.
	 * @param LicenseManagerInterface|null $licenseManager Optional license manager (Pro).
	 */
	public function __construct( $caps, $licenseManager = null ) {
		$this->caps           = $caps;
		$this->licenseManager = $licenseManager;
	}

	// ── Capability checks (freemium gate) ──────────────────────────────

	/**
	 * Check if a capability is allowed.
	 *
	 * @param string $capability Capability key from Capabilities::defaults().
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

	// ── License checks (Pro gate) ──────────────────────────────────────

	/**
	 * Whether a LicenseManager is available.
	 *
	 * @return bool
	 */
	public function hasLicensing(): bool {
		return $this->licenseManager !== null;
	}

	/**
	 * Check if a valid Pro license is active.
	 *
	 * @return bool Always false when no LicenseManager is injected.
	 */
	public function isPro(): bool {
		return $this->licenseManager ? $this->licenseManager->isValid() : false;
	}

	/**
	 * Check if a specific Pro feature is available.
	 *
	 * Falls back to capabilities map when no LicenseManager is set, so
	 * freemium defaults still work.
	 *
	 * @param string $feature Feature key (e.g. 'conditional_logic').
	 * @return bool
	 */
	public function hasFeature( string $feature ): bool {
		if ( $this->licenseManager ) {
			return $this->licenseManager->hasFeature( $feature );
		}

		// Fall back to capability map for freemium gating.
		return $this->allows( $feature );
	}

	/**
	 * Get the LicenseManager, if available.
	 *
	 * @return LicenseManagerInterface|null
	 */
	public function getLicenseManager(): ?LicenseManagerInterface {
		return $this->licenseManager;
	}
}
