<?php
/**
 * The saved connection of one email marketing service.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores the API key, the on/off switch and the service's own settings in one
 * option per service, which WordPress does not load on every request. The key
 * is read only by the code that talks to the service. Everything handed to the
 * browser comes from state(), which holds the last four characters of the key
 * and never the key itself.
 *
 * Switching a service off changes only the `enabled` flag: the key, the
 * settings and every form's settings are kept, so switching it on restores
 * them.
 */
final class Connection {

	/** @var string */
	const STATUS_CONNECTED = 'connected';

	/** @var string */
	const STATUS_ERROR = 'error';

	/** @var string */
	const STATUS_NONE = 'none';

	/** @var string */
	private string $slug;

	/**
	 * @param string $slug Service slug (mailchimp, brevo, kit).
	 */
	public function __construct( string $slug ) {
		$this->slug = sanitize_key( $slug );
	}

	/**
	 * Name of the option that holds the connection. Not autoloaded.
	 *
	 * @param string $slug Service slug.
	 */
	public static function optionName( string $slug ): string {
		return 'subtleforms_' . sanitize_key( $slug ) . '_connection';
	}

	/**
	 * The stored record.
	 *
	 * @return array{api_key:string,account_name:string,account_email:string,account_id:string,status:string,error:string,checked_at:int,enabled:bool,settings:array}
	 */
	private function record(): array {
		$stored = get_option( self::optionName( $this->slug ), array() );
		$stored = is_array( $stored ) ? $stored : array();
		return array(
			'api_key'       => isset( $stored['api_key'] ) ? trim( (string) $stored['api_key'] ) : '',
			'account_name'  => (string) ( $stored['account_name'] ?? '' ),
			'account_email' => (string) ( $stored['account_email'] ?? '' ),
			'account_id'    => (string) ( $stored['account_id'] ?? '' ),
			'status'        => (string) ( $stored['status'] ?? '' ),
			'error'         => (string) ( $stored['error'] ?? '' ),
			'checked_at'    => (int) ( $stored['checked_at'] ?? 0 ),
			'enabled'       => ! empty( $stored['enabled'] ),
			'settings'      => is_array( $stored['settings'] ?? null ) ? $stored['settings'] : array(),
		);
	}

	/**
	 * Write the record without autoload.
	 *
	 * @param array $record Record.
	 */
	private function write( array $record ): void {
		$name = self::optionName( $this->slug );
		if ( false === get_option( $name, false ) ) {
			add_option( $name, $record, '', false );
			return;
		}
		update_option( $name, $record, false );
	}

	/**
	 * The API key, for requests only.
	 */
	public function apiKey(): string {
		return $this->record()['api_key'];
	}

	/**
	 * Whether a key is saved.
	 */
	public function hasKey(): bool {
		return '' !== $this->record()['api_key'];
	}

	/**
	 * Whether the site owner switched the service on.
	 */
	public function isEnabled(): bool {
		return $this->record()['enabled'];
	}

	/**
	 * Whether the service can send: switched on and a key saved.
	 */
	public function isActive(): bool {
		$record = $this->record();
		return $record['enabled'] && '' !== $record['api_key'];
	}

	/**
	 * Switch the service on or off. The key and settings are not touched.
	 *
	 * @param bool $enabled On or off.
	 */
	public function setEnabled( bool $enabled ): void {
		$record            = $this->record();
		$record['enabled'] = $enabled;
		$this->write( $record );
	}

	/**
	 * Status of the connection: connected, error (the last check failed) or none.
	 */
	public function status(): string {
		$record = $this->record();
		if ( '' === $record['api_key'] ) {
			return self::STATUS_NONE;
		}
		return self::STATUS_ERROR === $record['status'] ? self::STATUS_ERROR : self::STATUS_CONNECTED;
	}

	/**
	 * The service's ID for the account from a check's answer: digits and letters only.
	 *
	 * @param array $account Account details (`id` or `portal_id`).
	 */
	private static function accountId( array $account ): string {
		$id = (string) ( $account['id'] ?? $account['portal_id'] ?? '' );
		return preg_replace( '/[^A-Za-z0-9_-]/', '', $id ) ?? '';
	}

	/**
	 * The last four characters of a key.
	 *
	 * @param string $key API key.
	 */
	public static function lastFour( string $key ): string {
		return strlen( $key ) > 4 ? substr( $key, -4 ) : '';
	}

	/**
	 * What the browser may see. Never the key.
	 *
	 * `connected` is true when a key is saved and its last check did not fail.
	 *
	 * `account_id` is the service's own ID for the account when it told us one
	 * (HubSpot's portal ID), used to build links into the service.
	 *
	 * @return array{status:string,enabled:bool,has_key:bool,connected:bool,last4:string,account_name:string,account_email:string,account_id:string,error:string,checked_at:int,settings:array}
	 */
	public function state(): array {
		$record = $this->record();
		return array(
			'status'        => $this->status(),
			'enabled'       => $record['enabled'],
			'has_key'       => '' !== $record['api_key'],
			'connected'     => '' !== $record['api_key'] && self::STATUS_ERROR !== $record['status'],
			'last4'         => self::lastFour( $record['api_key'] ),
			'account_name'  => $record['account_name'],
			'account_email' => $record['account_email'],
			'account_id'    => $record['account_id'],
			'error'         => $record['error'],
			'checked_at'    => $record['checked_at'],
			'settings'      => $record['settings'],
		);
	}

	/**
	 * The service's own settings.
	 *
	 * @return array<string,mixed>
	 */
	public function settings(): array {
		return $this->record()['settings'];
	}

	/**
	 * Save the service's own settings (already cleaned by the service).
	 *
	 * @param array $settings Settings.
	 */
	public function saveSettings( array $settings ): void {
		$record             = $this->record();
		$record['settings'] = $settings;
		$this->write( $record );
	}

	/**
	 * Save a key that has just passed a check.
	 *
	 * @param string    $key     API key.
	 * @param array     $account Account details from the check: name, email, id (or portal_id).
	 * @param bool|null $enabled New switch; null keeps the current one.
	 */
	public function save( string $key, array $account = array(), ?bool $enabled = null ): void {
		$record                  = $this->record();
		$record['api_key']       = trim( $key );
		$record['account_name']  = (string) ( $account['name'] ?? '' );
		$record['account_email'] = (string) ( $account['email'] ?? '' );
		$record['account_id']    = self::accountId( $account );
		$record['status']        = self::STATUS_CONNECTED;
		$record['error']         = '';
		$record['checked_at']    = time();
		if ( null !== $enabled ) {
			$record['enabled'] = $enabled;
		}
		$this->write( $record );
	}

	/**
	 * Note the result of a check of the saved key.
	 *
	 * @param bool   $ok      Whether the service accepted the key.
	 * @param array  $account Account details when it did.
	 * @param string $error   Plain reason when it did not.
	 */
	public function recordCheck( bool $ok, array $account = array(), string $error = '' ): void {
		$record = $this->record();
		if ( '' === $record['api_key'] ) {
			return;
		}
		$record['status']     = $ok ? self::STATUS_CONNECTED : self::STATUS_ERROR;
		$record['error']      = $ok ? '' : $error;
		$record['checked_at'] = time();
		if ( $ok ) {
			$record['account_name']  = (string) ( $account['name'] ?? $record['account_name'] );
			$record['account_email'] = (string) ( $account['email'] ?? $record['account_email'] );
			$id                      = self::accountId( $account );
			$record['account_id']    = '' !== $id ? $id : $record['account_id'];
		}
		$this->write( $record );
	}

	/**
	 * Remove the key and what was learned with it. The switch and the
	 * service's settings stay.
	 */
	public function clear(): void {
		$record                  = $this->record();
		$record['api_key']       = '';
		$record['account_name']  = '';
		$record['account_email'] = '';
		$record['account_id']    = '';
		$record['status']        = '';
		$record['error']         = '';
		$record['checked_at']    = 0;
		$this->write( $record );
	}

	/**
	 * Cache key for a list of lists or fields. It carries a hash of the key,
	 * so a new key never sees the old key's lists.
	 *
	 * @param string $what What is cached.
	 */
	public function cacheKey( string $what ): string {
		return 'subtleforms_em_' . md5( $this->slug . '|' . $what . '|' . $this->apiKey() );
	}
}
