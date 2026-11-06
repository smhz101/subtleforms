<?php
/**
 * Whether MailPoet, a plugin on this same site, can take subscribers.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.9.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * MailPoet has no API key and no web request: SubtleForms calls its PHP API
 * (`\MailPoet\API\API::MP( 'v1' )`) in the same request. So the connection is
 * not stored. It is worked out each time from the site:
 *
 * - `not_installed`: the plugin is not in the plugins folder.
 * - `inactive`: installed, not active.
 * - `outdated`: active, but its API lacks a method this plugin calls.
 * - `setup`: active, but MailPoet's own setup is not finished.
 * - `ready`: active and set up. This is the only state that sends.
 *
 * The API methods used are checked by name, not by version number, so a
 * MailPoet that has them works whatever it is called.
 */
final class MailPoetStatus {

	/** Plugin file, as WordPress lists it. */
	const PLUGIN = 'mailpoet/mailpoet.php';

	/** Class that hands out the API. */
	const API_CLASS = '\\MailPoet\\API\\API';

	/** Methods of the v1 API this plugin calls. */
	const REQUIRED = array( 'getLists', 'getSubscriberFields', 'getSubscriber', 'addSubscriber', 'subscribeToLists', 'isSetupComplete' );

	/**
	 * Replaces how the site is looked at. Tests only.
	 *
	 * @internal
	 * @var callable|null Returns array{api:?object,installed:bool,loaded?:bool}.
	 */
	public static $probe = null;

	/**
	 * What the site has: the v1 API object when MailPoet is loaded, and
	 * whether the plugin is installed.
	 *
	 * @return array{api:?object,installed:bool,loaded:bool} `loaded` is true when MailPoet's code is running.
	 */
	private static function look(): array {
		if ( is_callable( self::$probe ) ) {
			$seen = call_user_func( self::$probe );
			$api  = is_object( $seen['api'] ?? null ) ? $seen['api'] : null;
			return array(
				'api'       => $api,
				'installed' => ! empty( $seen['installed'] ) || null !== $api || ! empty( $seen['loaded'] ),
				'loaded'    => null !== $api || ! empty( $seen['loaded'] ),
			);
		}

		$api = null;
		if ( class_exists( self::API_CLASS ) && method_exists( self::API_CLASS, 'MP' ) ) {
			try {
				$candidate = call_user_func( array( self::API_CLASS, 'MP' ), 'v1' );
				$api       = is_object( $candidate ) ? $candidate : null;
			} catch ( \Throwable $e ) {
				$api = null;
			}
		}
		$loaded = class_exists( self::API_CLASS );
		return array(
			'api'       => $api,
			'installed' => $loaded || self::pluginFileExists(),
			'loaded'    => $loaded,
		);
	}

	/**
	 * Whether MailPoet's plugin file is in the plugins folder.
	 */
	private static function pluginFileExists(): bool {
		if ( ! function_exists( 'get_plugins' ) ) {
			$file = ABSPATH . 'wp-admin/includes/plugin.php';
			if ( ! is_readable( $file ) ) {
				return false;
			}
			require_once $file;
		}
		return array_key_exists( self::PLUGIN, get_plugins() );
	}

	/**
	 * The v1 API when MailPoet is loaded and has every method this plugin
	 * calls, else null.
	 */
	public static function api(): ?object {
		$api = self::look()['api'];
		if ( null === $api ) {
			return null;
		}
		foreach ( self::REQUIRED as $method ) {
			if ( ! method_exists( $api, $method ) ) {
				return null;
			}
		}
		return $api;
	}

	/**
	 * The state of MailPoet on this site: not_installed, inactive, outdated,
	 * setup or ready.
	 */
	public static function state(): string {
		$seen = self::look();
		if ( null === $seen['api'] ) {
			if ( $seen['loaded'] ) {
				// MailPoet is loaded but would not hand out its API.
				return 'outdated';
			}
			return $seen['installed'] ? 'inactive' : 'not_installed';
		}
		if ( null === self::api() ) {
			return 'outdated';
		}
		try {
			$complete = (bool) $seen['api']->isSetupComplete();
		} catch ( \Throwable $e ) {
			$complete = false;
		}
		return $complete ? 'ready' : 'setup';
	}

	/**
	 * Whether MailPoet can take subscribers right now.
	 */
	public static function ready(): bool {
		return 'ready' === self::state();
	}

	/**
	 * What the screens show: the state and the addresses the current user
	 * may follow (an address is empty when the user lacks the capability).
	 *
	 * @return array<string,mixed>
	 */
	public static function describe(): array {
		$state = self::state();
		return array(
			'state'          => $state,
			'installed'      => 'not_installed' !== $state,
			'active'         => ! in_array( $state, array( 'not_installed', 'inactive' ), true ),
			'setup_complete' => 'ready' === $state,
			'outdated'       => 'outdated' === $state,
			'manage_url'     => admin_url( 'admin.php?page=mailpoet-lists' ),
			'setup_url'      => admin_url( 'admin.php?page=mailpoet-welcome-wizard' ),
			'activate_url'   => 'inactive' === $state && current_user_can( 'activate_plugins' ) ? self::activateUrl() : '',
			'install_url'    => 'not_installed' === $state && current_user_can( 'install_plugins' ) ? admin_url( 'plugin-install.php?s=mailpoet&tab=search&type=term' ) : '',
			'update_url'     => 'outdated' === $state && current_user_can( 'update_plugins' ) ? admin_url( 'plugins.php' ) : '',
			'can_activate'   => current_user_can( 'activate_plugins' ),
			'can_install'    => current_user_can( 'install_plugins' ),
		);
	}

	/**
	 * WordPress's own activation link for MailPoet, with the core nonce.
	 */
	public static function activateUrl(): string {
		// Built with add_query_arg so the separators stay plain `&`: wp_nonce_url()
		// HTML-escapes them, and a React href would then carry `&amp;`.
		return add_query_arg(
			array(
				'action'   => 'activate',
				'plugin'   => self::PLUGIN,
				'_wpnonce' => wp_create_nonce( 'activate-plugin_' . self::PLUGIN ),
			),
			self_admin_url( 'plugins.php' )
		);
	}

	/**
	 * A plain sentence for the entry log when MailPoet cannot take people.
	 */
	public static function reason(): string {
		switch ( self::state() ) {
			case 'not_installed':
				return __( 'MailPoet is not installed on this site', 'subtleforms' );
			case 'inactive':
				return __( 'MailPoet is not active on this site', 'subtleforms' );
			case 'setup':
				return __( 'MailPoet setup is not finished', 'subtleforms' );
			case 'outdated':
				return __( 'MailPoet needs an update to work with SubtleForms', 'subtleforms' );
			default:
				return '';
		}
	}
}
