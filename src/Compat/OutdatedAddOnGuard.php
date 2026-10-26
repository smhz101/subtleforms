<?php
/**
 * Keeps an add-on that was built for an earlier version of SubtleForms from
 * starting.
 *
 * Add-on builds before 2.7.0 depend on a PHP interface that this plugin no
 * longer ships, so starting them ends the request with a fatal error. Build
 * 2.7.0 needs extension level 2 and imports pricing modules that this plugin
 * no longer ships, so it cannot work either. This guard removes only the
 * add-on's start-up callback for the current request. It does not deactivate
 * anything, change any option or look at any account data. Once the add-on is
 * updated to the minimum version it starts normally.
 *
 * @package SubtleForms\Compat
 */

namespace SubtleForms\Compat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detects an outdated SubtleForms Pro and stops it from starting.
 */
class OutdatedAddOnGuard {

	/**
	 * First SubtleForms Pro version that works with this plugin.
	 */
	public const MIN_PRO_VERSION = '2.8.0';

	/**
	 * Function every older Pro build hooks to start itself.
	 */
	private const PRO_BOOT_CALLBACK = 'subtleforms_pro_init';

	/**
	 * Hook the older Pro build uses to start itself.
	 */
	private const PRO_BOOT_HOOK = 'plugins_loaded';

	/**
	 * Version of the outdated add-on that was stopped, or '' when none was.
	 *
	 * @var string
	 */
	private static string $blocked_version = '';

	/**
	 * Stop an outdated Pro from starting and queue the admin notice.
	 *
	 * Must run on plugins_loaded before the add-on's own callback (priority 20
	 * in every released build). The add-on's main file has already been
	 * included by then, so its version constant and callback exist.
	 *
	 * @param string|null $version Add-on version to check. Defaults to the
	 *                             SUBTLEFORMS_PRO_VERSION constant (used by tests).
	 */
	public static function apply( ?string $version = null ): void {
		self::$blocked_version = '';

		if ( null === $version ) {
			$version = defined( 'SUBTLEFORMS_PRO_VERSION' ) ? (string) SUBTLEFORMS_PRO_VERSION : '';
		}

		if ( '' === $version ) {
			return;
		}

		if ( version_compare( $version, self::MIN_PRO_VERSION, '>=' ) ) {
			return;
		}

		$priority = has_action( self::PRO_BOOT_HOOK, self::PRO_BOOT_CALLBACK );

		if ( false === $priority ) {
			return;
		}

		remove_action( self::PRO_BOOT_HOOK, self::PRO_BOOT_CALLBACK, (int) $priority );

		self::$blocked_version = $version;
	}

	/**
	 * Version of the add-on that was stopped on this request.
	 *
	 * @return string Version, or '' when nothing was stopped.
	 */
	public static function blocked_version(): string {
		return self::$blocked_version;
	}

	/**
	 * First compatible version, for the admin notice.
	 *
	 * @return string Version.
	 */
	public static function minimum_version(): string {
		return self::MIN_PRO_VERSION;
	}
}
