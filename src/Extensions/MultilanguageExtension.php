<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

/**
 * Multilanguage Extension
 *
 * Registers SubtleForms strings with WPML or Polylang so they can be
 * translated via those plugins' string-translation interfaces.
 */
class MultilanguageExtension extends AbstractExtension {

	public function slug(): string {
		return 'multilanguage';
	}

	public function label(): string {
		return 'Multilanguage';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		$provider = (string) $this->getSetting( 'provider' );

		if ( 'polylang' === $provider ) {
			add_action( 'init', array( $this, 'registerPolylang' ), 15 );
		} else {
			// Default to WPML.
			add_action( 'wpml_multilingual_options', array( $this, 'registerWpml' ) );
		}
	}

	/**
	 * Register translatable strings with Polylang.
	 */
	public function registerPolylang(): void {
		if ( ! function_exists( 'pll_register_string' ) ) {
			return;
		}

		/**
		 * Allow other code to supply strings to register.
		 *
		 * @param array $strings {
		 *   @type string $name   String identifier.
		 *   @type string $value  Default (source) value.
		 * }
		 */
		$strings = apply_filters( 'subtleforms/multilanguage/strings', array() );

		foreach ( $strings as $item ) {
			if ( ! empty( $item['name'] ) && ! empty( $item['value'] ) ) {
				pll_register_string( $item['name'], $item['value'], 'SubtleForms' );
			}
		}
	}

	/**
	 * Register translatable strings with WPML.
	 */
	public function registerWpml(): void {
		if ( ! function_exists( 'icl_register_string' ) ) {
			return;
		}

		$strings = apply_filters( 'subtleforms/multilanguage/strings', array() );

		foreach ( $strings as $item ) {
			if ( ! empty( $item['name'] ) && ! empty( $item['value'] ) ) {
				icl_register_string( 'SubtleForms', $item['name'], $item['value'] );
			}
		}
	}
}
