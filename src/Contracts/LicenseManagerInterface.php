<?php
/**
 * License Manager Interface.
 *
 * Defines the contract that any licensing implementation must satisfy.
 * The free plugin ships this interface only; the Pro plugin provides the
 * concrete implementation via its own LicenseManager class.
 *
 * @package SubtleForms\Contracts
 * @since   1.9.0
 */

namespace SubtleForms\Contracts;

/**
 * Interface LicenseManagerInterface
 */
interface LicenseManagerInterface {

	/**
	 * Whether the current license is valid and active.
	 *
	 * @return bool
	 */
	public function isValid(): bool;

	/**
	 * Check if a specific feature is available under the current license.
	 *
	 * @param string $feature Feature key (e.g. 'conditional_logic').
	 * @return bool
	 */
	public function hasFeature( string $feature ): bool;

	/**
	 * Get the current license status string.
	 *
	 * @return string One of 'valid', 'expired', 'invalid', 'inactive', 'grace_period'.
	 */
	public function getStatus(): string;
}
