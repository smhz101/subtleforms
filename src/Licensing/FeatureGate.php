<?php

namespace SubtleForms\Licensing;

/**
 * Feature Gate Utility
 *
 * Provides convenient methods for checking feature availability.
 * Acts as a facade for LicenseManager with caching.
 *
 * @package SubtleForms\Licensing
 * @since 2.0.0
 */
class FeatureGate {

	/**
	 * @var LicenseManager
	 */
	private static $license_manager;

	/**
	 * Cached feature checks
	 *
	 * @var array
	 */
	private static $cache = array();

	/**
	 * Set license manager instance
	 *
	 * @param LicenseManager $manager License manager
	 */
	public static function setLicenseManager( LicenseManager $manager ) {
		self::$license_manager = $manager;
		self::$cache           = array(); // Clear cache on manager change
	}

	/**
	 * Check if Pro version is active
	 *
	 * @return bool
	 */
	public static function isPro() {
		if ( isset( self::$cache['is_pro'] ) ) {
			return self::$cache['is_pro'];
		}

		$result = self::getLicenseManager()->isValid();

		self::$cache['is_pro'] = $result;

		return $result;
	}

	/**
	 * Check if specific feature is available
	 *
	 * @param string $feature Feature key
	 * @return bool
	 */
	public static function hasFeature( $feature ) {
		$cache_key = 'feature_' . $feature;

		if ( isset( self::$cache[ $cache_key ] ) ) {
			return self::$cache[ $cache_key ];
		}

		$result = self::getLicenseManager()->hasFeature( $feature );

		self::$cache[ $cache_key ] = $result;

		return $result;
	}

	/**
	 * Check if AI features are available
	 *
	 * @return bool
	 */
	public static function canUseAI() {
		return self::hasFeature( 'ai_spam_detection' ) ||
		       self::hasFeature( 'ai_workflows' ) ||
		       self::hasFeature( 'ai_form_assist' ) ||
		       self::hasFeature( 'ai_routing' );
	}

	/**
	 * Check if specific AI agent is available
	 *
	 * @param string $agent Agent name (spam_detection, workflows, form_assist, routing)
	 * @return bool
	 */
	public static function canUseAIAgent( $agent ) {
		$feature_map = array(
			'spam_detection' => 'ai_spam_detection',
			'workflows'      => 'ai_workflows',
			'form_assist'    => 'ai_form_assist',
			'routing'        => 'ai_routing',
		);

		$feature = $feature_map[ $agent ] ?? null;

		if ( ! $feature ) {
			return false;
		}

		return self::hasFeature( $feature );
	}

	/**
	 * Check if conditional logic is available
	 *
	 * @return bool
	 */
	public static function hasConditionalLogic() {
		return self::hasFeature( 'conditional_logic' );
	}

	/**
	 * Check if file uploads are available
	 *
	 * @return bool
	 */
	public static function hasFileUploads() {
		return self::hasFeature( 'file_uploads' );
	}

	/**
	 * Check if payment forms are available
	 *
	 * @return bool
	 */
	public static function hasPaymentForms() {
		return self::hasFeature( 'payment_forms' );
	}

	/**
	 * Check if webhooks are available
	 *
	 * @return bool
	 */
	public static function hasWebhooks() {
		return self::hasFeature( 'webhooks' );
	}

	/**
	 * Check if advanced fields are available
	 *
	 * @return bool
	 */
	public static function hasAdvancedFields() {
		return self::hasFeature( 'advanced_fields' );
	}

	/**
	 * Check if Pro templates are available
	 *
	 * @return bool
	 */
	public static function hasProTemplates() {
		return self::hasFeature( 'templates.pro' );
	}

	/**
	 * Get license status
	 *
	 * @return string Status code
	 */
	public static function getStatus() {
		return self::getLicenseManager()->getStatus();
	}

	/**
	 * Get license plan
	 *
	 * @return string Plan name
	 */
	public static function getPlan() {
		return self::getLicenseManager()->getPlan();
	}

	/**
	 * Get days until expiration
	 *
	 * @return int|null
	 */
	public static function getDaysUntilExpiration() {
		return self::getLicenseManager()->getDaysUntilExpiration();
	}

	/**
	 * Gate a feature with callback
	 *
	 * Executes callback only if feature is available
	 *
	 * @param string   $feature  Feature key
	 * @param callable $callback Callback to execute if feature is available
	 * @param callable $fallback Optional fallback if feature not available
	 * @return mixed Result of callback or fallback
	 */
	public static function gate( $feature, callable $callback, callable $fallback = null ) {
		if ( self::hasFeature( $feature ) ) {
			return $callback();
		}

		if ( $fallback ) {
			return $fallback();
		}

		return null;
	}

	/**
	 * Require a feature or throw exception
	 *
	 * @param string $feature Feature key
	 * @param string $message Optional custom error message
	 * @throws \Exception If feature not available
	 */
	public static function requireFeature( $feature, $message = '' ) {
		if ( ! self::hasFeature( $feature ) ) {
			if ( empty( $message ) ) {
				$message = sprintf(
					/* translators: %s: feature name */
					__( 'This feature requires SubtleForms Pro: %s', 'subtleforms' ),
					$feature
				);
			}

			throw new \Exception( $message );
		}
	}

	/**
	 * Check if in grace period
	 *
	 * @return bool
	 */
	public static function isGracePeriod() {
		$status = self::getStatus();
		return $status === LicenseManager::STATUS_GRACE_PERIOD;
	}

	/**
	 * Get upgrade URL
	 *
	 * @param string $feature Optional feature to highlight
	 * @return string
	 */
	public static function getUpgradeUrl( $feature = '' ) {
		$url = 'https://subtleforms.com/pricing/';

		if ( ! empty( $feature ) ) {
			$url = add_query_arg( 'feature', $feature, $url );
		}

		return apply_filters( 'subtleforms_upgrade_url', $url, $feature );
	}

	/**
	 * Render Pro badge HTML
	 *
	 * @param array $args Badge arguments
	 * @return string HTML
	 */
	public static function renderProBadge( $args = array() ) {
		$defaults = array(
			'text'  => __( 'Pro', 'subtleforms' ),
			'class' => 'sf-pro-badge',
			'icon'  => '👑',
		);

		$args = wp_parse_args( $args, $defaults );

		return sprintf(
			'<span class="%s">%s %s</span>',
			esc_attr( $args['class'] ),
			$args['icon'],
			esc_html( $args['text'] )
		);
	}

	/**
	 * Render upgrade prompt HTML
	 *
	 * @param string $feature Feature name
	 * @return string HTML
	 */
	public static function renderUpgradePrompt( $feature ) {
		$upgrade_url = self::getUpgradeUrl( $feature );

		ob_start();
		?>
		<div class="sf-upgrade-prompt">
			<div class="sf-upgrade-prompt__icon">🔒</div>
			<h3 class="sf-upgrade-prompt__title">
				<?php esc_html_e( 'Pro Feature', 'subtleforms' ); ?>
			</h3>
			<p class="sf-upgrade-prompt__message">
				<?php
				printf(
					/* translators: %s: feature name */
					esc_html__( 'This feature requires SubtleForms Pro. Upgrade now to unlock %s and more!', 'subtleforms' ),
					'<strong>' . esc_html( $feature ) . '</strong>'
				);
				?>
			</p>
			<a href="<?php echo esc_url( $upgrade_url ); ?>" class="sf-btn sf-btn--primary" target="_blank">
				<?php esc_html_e( 'Upgrade to Pro', 'subtleforms' ); ?>
			</a>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Clear feature cache
	 */
	public static function clearCache() {
		self::$cache = array();
	}

	/**
	 * Get license manager instance
	 *
	 * @return LicenseManager
	 * @throws \RuntimeException If license manager not set
	 */
	private static function getLicenseManager() {
		if ( ! self::$license_manager ) {
			// Try to get from container
			if ( function_exists( 'subtleforms' ) ) {
				self::$license_manager = subtleforms()->get( LicenseManager::class );
			}

			if ( ! self::$license_manager ) {
				throw new \RuntimeException( 'License manager not initialized' );
			}
		}

		return self::$license_manager;
	}
}
