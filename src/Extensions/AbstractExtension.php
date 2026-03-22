<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

use SubtleForms\Contracts\ExtensionInterface;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Settings;

/**
 * Base class for all built-in extensions.
 *
 * Concrete extensions only need to implement slug(), label(), and register().
 * requiredCapabilities() defaults to ["extensions.{slug}"], and isEnabled()
 * reads the matching ext_{slug}_enabled setting key.
 */
abstract class AbstractExtension implements ExtensionInterface {

	protected Settings    $settings;
	protected FeatureGate $gate;

	public function __construct( Settings $settings, FeatureGate $gate ) {
		$this->settings = $settings;
		$this->gate     = $gate;
	}

	/**
	 * Human-readable label shown in the Extensions UI.
	 */
	abstract public function label(): string;

	/**
	 * Returns the single capability key that guards this extension.
	 */
	public function requiredCapabilities(): array {
		return array( 'extensions.' . $this->slug() );
	}

	/**
	 * Whether the admin has turned this extension on via settings.
	 */
	protected function isEnabled(): bool {
		$key = 'ext_' . str_replace( '-', '_', $this->slug() ) . '_enabled';
		return (bool) $this->settings->get( $key );
	}

	/**
	 * Convenience wrapper: returns a setting value for this extension.
	 *
	 * @param string $key  Setting key suffix, e.g. "api_key" → reads "ext_{slug}_api_key".
	 */
	protected function getSetting( string $key ) {
		$full_key = 'ext_' . str_replace( '-', '_', $this->slug() ) . '_' . $key;
		return $this->settings->get( $full_key );
	}
}
