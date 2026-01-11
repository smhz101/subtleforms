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
	 * @param array<string,bool> $defaults
	 */
	public function __construct( array $defaults = array() ) {
		$this->map = $defaults ?: self::defaults();
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
		return array(
			'forms.unlimited'            => true,

			'logic.conditional.basic'    => true,
			'logic.conditional.advanced' => false,

			'pipeline.retry'             => false,
			'pipeline.delay'             => false,

			'actions.save'               => true,
			'actions.webhook'            => true,
			'actions.email'              => true,
			'actions.payment'            => false,

			'extensions.custom'          => false,

			'api.read'                   => true,
			'api.write'                  => true,
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
