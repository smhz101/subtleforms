<?php

/**
 * SubtleForms Capabilities Service.
 *
 * @package SubtleForms\Support
 * @since   0.1.0
 */

namespace SubtleForms\Support;

/**
 * Capabilities service for feature gating.
 *
 * - Freemium defines default capabilities.
 * - Premium can override via a filter (or license module later).
 * - Code should never ask "is premium?" - it should ask "is capability allowed?"
 */
final class Capabilities {
	/**
	 * @var array<string,bool>
	 */
	private array $map;

	/**
	 * @param array<string,bool> $defaults Optional capability overrides.
	 */
	public function __construct( array $defaults = array() ) {
		$this->map = $defaults ?: self::defaults();

		// Pro plugin injects capability upgrades via this filter.
		$this->map = apply_filters( 'subtleforms/capabilities', $this->map );
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
	 * Default freemium capabilities.
	 *
	 * @return array<string,bool>
	 */
	public static function defaults() {
		// Keys such as fields.advanced, actions.payment, extensions.*,
		// templates.pro and branding.white_label belong to SubtleForms Pro.
		// Pro adds them through the `subtleforms/capabilities` filter and
		// only Pro code reads them; a missing key reads as false.
		return array(
			// Everything the free plugin ships is on. Free code never asks
			// for a capability that is off by default (WordPress.org
			// guideline 5): a license adds code, it never switches free
			// code on.
			'forms.unlimited'            => true,

			'logic.conditional.basic'    => true,
			'logic.conditional.advanced' => true,

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
		return (bool) ( $this->map[ $capability ] ?? false );
	}

	/**
	 * @return array<string,bool>
	 */
	public function all() {
		return $this->map;
	}
}
