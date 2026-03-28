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
	 * @param array<string,bool>                                       $defaults
	 * @param \SubtleForms\Licensing\SubscriptionManager|null $subscriptionManager
	 */
	public function __construct( array $defaults = array(), $subscriptionManager = null ) {
		$this->map = $defaults ?: self::defaults();

		// Apply subscription-based overrides (after free defaults, before Pro plugin filter).
		if ( $subscriptionManager !== null ) {
			$subCaps = $subscriptionManager->getCapabilities();
			if ( ! empty( $subCaps ) ) {
				$this->map = array_merge( $this->map, $subCaps );
			}
		}

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

			// Extensions — all disabled in free tier, Pro plugin overrides via subtleforms/capabilities filter
			'extensions.webhooks'        => false,
			'extensions.email_marketing' => false,
			'extensions.crm'             => false,
			'extensions.analytics'       => false,
			'extensions.ecommerce'       => false,
			'extensions.pdf'             => false,
			'extensions.multilanguage'   => false,
			'extensions.payments'        => false,

			// Templates (existing Pro feature key)
			'templates.pro'              => false,

			// Submissions
			'submissions.export'         => false,
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
