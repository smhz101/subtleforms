<?php
/**
 * The saved Mailchimp connection.
 *
 * @package SubtleForms\Integrations\Mailchimp
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Mailchimp;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores the API key in its own option, which WordPress does not load on
 * every request. The key is read only by the code that talks to Mailchimp.
 * Everything handed to the browser comes from state(), which holds the last
 * four characters of the key and never the key itself.
 */
final class Connection {

	/** Option that holds the connection. Not autoloaded. */
	const OPTION = 'subtleforms_mailchimp_connection';

	/** @var string */
	const STATUS_CONNECTED = 'connected';

	/** @var string */
	const STATUS_ERROR = 'error';

	/** @var string */
	const STATUS_NONE = 'none';

	/**
	 * The stored record.
	 *
	 * @return array{api_key:string,account_name:string,account_email:string,status:string,error:string,checked_at:int}
	 */
	private static function record(): array {
		$stored = get_option( self::OPTION, array() );
		$stored = is_array( $stored ) ? $stored : array();
		return array(
			'api_key'       => isset( $stored['api_key'] ) ? trim( (string) $stored['api_key'] ) : '',
			'account_name'  => (string) ( $stored['account_name'] ?? '' ),
			'account_email' => (string) ( $stored['account_email'] ?? '' ),
			'status'        => (string) ( $stored['status'] ?? '' ),
			'error'         => (string) ( $stored['error'] ?? '' ),
			'checked_at'    => (int) ( $stored['checked_at'] ?? 0 ),
		);
	}

	/**
	 * Write the record without autoload.
	 *
	 * @param array $record Record.
	 */
	private static function write( array $record ): void {
		if ( false === get_option( self::OPTION, false ) ) {
			add_option( self::OPTION, $record, '', false );
			return;
		}
		update_option( self::OPTION, $record, false );
	}

	/**
	 * The API key, for requests only.
	 */
	public static function apiKey(): string {
		return self::record()['api_key'];
	}

	/**
	 * Whether a key is saved.
	 */
	public static function hasKey(): bool {
		return '' !== self::record()['api_key'];
	}

	/**
	 * Status of the connection: connected, error (the last check failed) or none.
	 */
	public static function status(): string {
		$record = self::record();
		if ( '' === $record['api_key'] ) {
			return self::STATUS_NONE;
		}
		return self::STATUS_ERROR === $record['status'] ? self::STATUS_ERROR : self::STATUS_CONNECTED;
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
	 * @return array{status:string,has_key:bool,last4:string,account_name:string,account_email:string,error:string,checked_at:int}
	 */
	public static function state(): array {
		$record = self::record();
		return array(
			'status'        => self::status(),
			'has_key'       => '' !== $record['api_key'],
			'last4'         => self::lastFour( $record['api_key'] ),
			'account_name'  => $record['account_name'],
			'account_email' => $record['account_email'],
			'error'         => $record['error'],
			'checked_at'    => $record['checked_at'],
		);
	}

	/**
	 * Save a key that has just passed a check.
	 *
	 * @param string $key     API key.
	 * @param array  $account Account details from the check: name, email.
	 */
	public static function save( string $key, array $account = array() ): void {
		self::write(
			array(
				'api_key'       => trim( $key ),
				'account_name'  => (string) ( $account['name'] ?? '' ),
				'account_email' => (string) ( $account['email'] ?? '' ),
				'status'        => self::STATUS_CONNECTED,
				'error'         => '',
				'checked_at'    => time(),
			)
		);
	}

	/**
	 * Note the result of a check of the saved key.
	 *
	 * @param bool   $ok      Whether Mailchimp accepted the key.
	 * @param array  $account Account details when it did.
	 * @param string $error   Plain reason when it did not.
	 */
	public static function recordCheck( bool $ok, array $account = array(), string $error = '' ): void {
		$record = self::record();
		if ( '' === $record['api_key'] ) {
			return;
		}
		$record['status']     = $ok ? self::STATUS_CONNECTED : self::STATUS_ERROR;
		$record['error']      = $ok ? '' : $error;
		$record['checked_at'] = time();
		if ( $ok ) {
			$record['account_name']  = (string) ( $account['name'] ?? $record['account_name'] );
			$record['account_email'] = (string) ( $account['email'] ?? $record['account_email'] );
		}
		self::write( $record );
	}

	/**
	 * Remove the key.
	 */
	public static function clear(): void {
		delete_option( self::OPTION );
	}

	/**
	 * Cache key for a list of audiences or fields. It carries a hash of the
	 * key, so a new key never sees the old key's lists.
	 *
	 * @param string $what What is cached.
	 */
	public static function cacheKey( string $what ): string {
		return 'subtleforms_mc_' . md5( $what . '|' . self::apiKey() );
	}

}
