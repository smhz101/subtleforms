<?php
/**
 * Keeps the secrets in the settings option sealed in the database.
 *
 * The rest of the plugin, and SubtleForms Pro, keep reading and writing plain
 * values: the settings option is opened on the way out and sealed on the way
 * in. A value saved before 2.12.0 is read as it is and sealed the first time
 * it is read.
 *
 * @package SubtleForms\Support
 * @since   2.12.0
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SettingsSecrets {

	/** Settings that hold a secret: CAPTCHA secret keys and the default webhook signing secret. */
	const KEYS = array(
		'captcha_recaptcha_secret_key',
		'captcha_hcaptcha_secret_key',
		'captcha_turnstile_secret_key',
		'ext_webhooks_signing_secret',
	);

	/** Prefix SubtleForms Pro puts on the signing secret it encrypts itself. */
	const PRO_PREFIX = 'sfenc:v1:';

	/** @var string[] Keys whose sealed value could not be opened on this request. */
	private static array $unreadable = array();

	/** @var bool A plain value was read and is waiting to be sealed. */
	private static bool $pending = false;

	/**
	 * Hook in. Priority 5 and 20 put this around Pro's own filters, which run at 10.
	 */
	public static function register(): void {
		add_filter( 'option_' . Settings::OPTION_NAME, array( self::class, 'open' ), 5 );
		add_filter( 'option_' . Settings::OPTION_NAME, array( self::class, 'dropUnopened' ), 20 );
		add_filter( 'pre_update_option_' . Settings::OPTION_NAME, array( self::class, 'seal' ), 20 );
	}

	/**
	 * Open sealed values read from the database.
	 *
	 * @param mixed $value Option value.
	 * @return mixed
	 */
	public static function open( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		foreach ( self::KEYS as $key ) {
			if ( ! isset( $value[ $key ] ) || ! is_string( $value[ $key ] ) || '' === $value[ $key ] ) {
				continue;
			}
			if ( SecretBox::isSealed( $value[ $key ] ) ) {
				$value[ $key ] = SecretBox::open( $value[ $key ] );
				if ( '' === $value[ $key ] ) {
					self::unreadable( $key );
				}
			} elseif ( 0 !== strpos( $value[ $key ], self::PRO_PREFIX ) && SecretBox::available() ) {
				self::queueMigration();
			}
		}
		return $value;
	}

	/**
	 * A value Pro encrypted that is still encrypted here means Pro is not
	 * active: it cannot be used, so it counts as missing.
	 *
	 * @param mixed $value Option value.
	 * @return mixed
	 */
	public static function dropUnopened( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		foreach ( self::KEYS as $key ) {
			if ( isset( $value[ $key ] ) && is_string( $value[ $key ] ) && 0 === strpos( $value[ $key ], self::PRO_PREFIX ) ) {
				$value[ $key ] = '';
				self::unreadable( $key );
			}
		}
		return $value;
	}

	/**
	 * Seal secrets about to be saved.
	 *
	 * @param mixed $value Option value.
	 * @return mixed
	 */
	public static function seal( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		foreach ( self::KEYS as $key ) {
			if ( isset( $value[ $key ] ) && is_string( $value[ $key ] ) && 0 !== strpos( $value[ $key ], self::PRO_PREFIX ) ) {
				$value[ $key ] = SecretBox::seal( $value[ $key ] );
			}
		}
		return $value;
	}

	/**
	 * Setting keys whose saved secret cannot be read, for the settings screen.
	 *
	 * @return string[]
	 */
	public static function unreadableKeys(): array {
		get_option( Settings::OPTION_NAME, array() );
		return array_values( self::$unreadable );
	}

	/**
	 * Save the settings once more so a plain secret is stored sealed.
	 */
	public static function migrate(): void {
		self::$pending = true; // Reading the old value below must not queue another run.
		$settings      = get_option( Settings::OPTION_NAME, array() );
		if ( is_array( $settings ) ) {
			update_option( Settings::OPTION_NAME, $settings );
		}
	}

	/**
	 * Seal plain values at the end of the request that read them.
	 */
	private static function queueMigration(): void {
		if ( self::$pending ) {
			return;
		}
		self::$pending = true;
		add_action( 'shutdown', array( self::class, 'migrate' ) );
	}

	/**
	 * Note a secret that cannot be read. Logged once a day, never with the value.
	 *
	 * @param string $key Setting key.
	 */
	private static function unreadable( string $key ): void {
		if ( in_array( $key, self::$unreadable, true ) ) {
			return;
		}
		self::$unreadable[] = $key;
		$flag = 'subtleforms_unreadable_' . $key;
		if ( false === get_transient( $flag ) ) {
			set_transient( $flag, 1, DAY_IN_SECONDS );
			Logger::warning( 'The saved secret for %s could not be read. It has to be entered again.', $key );
		}
	}
}
