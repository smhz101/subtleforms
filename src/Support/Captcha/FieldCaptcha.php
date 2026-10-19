<?php
/**
 * Per-field CAPTCHA.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Support\Captcha;


if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A CAPTCHA field uses its own provider and keys, not whichever provider Settings has turned on (FA-13).
 */
final class FieldCaptcha {
	/**
	 * @param array<string, mixed> $field Field.
	 * @return string recaptcha, hcaptcha, turnstile, or empty.
	 */
	public static function provider( array $field ): string {
		$type = (string) ( $field['type'] ?? '' );
		if ( in_array( $type, array( 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
			return $type;
		}
		if ( 'captcha' === $type ) {
			$named = (string) ( $field['provider'] ?? ( $field['config']['provider'] ?? '' ) );
			return in_array( $named, array( 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ? $named : '';
		}
		return '';
	}

	/**
	 * @param array<string, mixed> $field    Field.
	 * @param array<string, mixed> $settings Global captcha settings.
	 * @return array{provider: string, site_key: string, secret: string, ready: bool, html: string, warning: string}
	 */
	public static function resolve( array $field, array $settings = array() ): array {
		$provider = self::provider( $field );
		$site     = self::key( $field, 'site_key' );
		$secret   = self::key( $field, 'secret_key' );
		if ( '' === $site ) {
			$site = self::global_key( $settings, $provider, 'site_key' );
		}
		if ( '' === $secret ) {
			$secret = self::global_key( $settings, $provider, 'secret_key' );
		}
		$ready   = '' !== $provider && '' !== $site && '' !== $secret;
		$warning = $ready ? '' : __( 'This CAPTCHA is not set up yet. Add a site key and a secret key, or turn the provider on in Settings.', 'subtleforms' );
		return array(
			'provider' => $provider,
			'site_key' => $site,
			'secret'   => $secret,
			'ready'    => $ready,
			'html'     => $ready ? self::html( $provider, $site ) : '',
			'warning'  => $warning,
		);
	}

	/**
	 * @param array<string, mixed> $schema Schema.
	 * @return array<int, array<string, mixed>>
	 */
	public static function fields( array $schema ): array {
		$found = array();
		self::walk( $schema['fields'] ?? array(), $found );
		return $found;
	}

	/**
	 * @param string $provider Provider slug.
	 * @param string $site     Site key.
	 * @return string
	 */
	public static function html( string $provider, string $site ): string {
		$site = esc_attr( $site );
		if ( 'hcaptcha' === $provider ) {
			return '<div class="h-captcha" data-sitekey="' . $site . '"></div>';
		}
		if ( 'turnstile' === $provider ) {
			return '<div class="cf-turnstile" data-sitekey="' . $site . '"></div>';
		}
		return '<div class="g-recaptcha" data-sitekey="' . $site . '"></div>';
	}

	/**
	 * @param array<string, mixed> $field Field.
	 * @param string               $name  site_key or secret_key.
	 * @return string
	 */
	private static function key( array $field, string $name ): string {
		$value = $field[ $name ] ?? ( $field['config'][ $name ] ?? '' );
		return is_string( $value ) ? trim( $value ) : '';
	}

	/**
	 * @param array<string, mixed> $settings Settings.
	 * @param string               $provider Provider.
	 * @param string               $name     Key name.
	 * @return string
	 */
	private static function global_key( array $settings, string $provider, string $name ): string {
		$bucket = $settings[ $provider ] ?? array();
		if ( ! is_array( $bucket ) ) {
			return '';
		}
		$value = $bucket[ $name ] ?? '';
		return is_string( $value ) ? trim( $value ) : '';
	}

	/**
	 * @param mixed                      $fields Nodes.
	 * @param array<int, array<string, mixed>> $found  Captcha fields.
	 * @return void
	 */
	private static function walk( $fields, array &$found ): void {
		if ( ! is_array( $fields ) ) {
			return;
		}
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( '' !== self::provider( $field ) ) {
				$found[] = $field;
			}
			foreach ( array( 'children', 'fields' ) as $child_key ) {
				if ( isset( $field[ $child_key ] ) ) {
					self::walk( $field[ $child_key ], $found );
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( ! is_array( $column ) ) {
						continue;
					}
					if ( isset( $column['fields'] ) || isset( $column['children'] ) ) {
						self::walk( $column['fields'] ?? array(), $found );
						self::walk( $column['children'] ?? array(), $found );
					} else {
						self::walk( $column, $found );
					}
				}
			}
		}
	}
}
