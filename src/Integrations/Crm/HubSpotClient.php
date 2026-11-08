<?php
/**
 * HubSpot CRM API v3 with a private app access token: the contact side.
 *
 * @package SubtleForms\Integrations\Crm
 * @since   2.8.1
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Crm;

use SubtleForms\Integrations\EmailMarketing\ServiceException;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Checks the token, lists the contact properties and creates or updates one
 * contact by email. Requests are plain arrays (method, url, headers, body) so
 * they can be checked without a network. This client calls only HubSpot's API
 * host, through the safe HTTP client.
 */
final class HubSpotClient {

	/** HubSpot API host. */
	const BASE = 'https://api.hubapi.com';

	/** Seconds to wait when a person is waiting in wp-admin. */
	const ADMIN_TIMEOUT = 10;

	/** Seconds to wait in the background job. */
	const JOB_TIMEOUT = 15;

	/** Properties HubSpot sets itself: never offered for mapping. */
	const SKIP_PROPERTIES = array( 'email', 'firstname', 'lastname', 'phone', 'company' );

	/** @var string */
	private string $token;

	/** @var int */
	private int $timeout;

	/**
	 * @param string $token   Private app access token.
	 * @param int    $timeout Seconds.
	 */
	public function __construct( string $token, int $timeout = self::ADMIN_TIMEOUT ) {
		$this->token   = trim( $token );
		$this->timeout = max( 3, $timeout );
	}

	/**
	 * Whether a text can be a private app access token. HubSpot's start with
	 * `pat-`; anything long without spaces is let through so a token format
	 * HubSpot adds later is not refused here. HubSpot has the last word.
	 *
	 * @param string $token Text.
	 */
	public static function looksLikeToken( string $token ): bool {
		$token = trim( $token );
		return 1 === preg_match( '/^pat-[A-Za-z0-9-]{16,}$/', $token ) || 1 === preg_match( '/^\S{30,}$/', $token );
	}

	/**
	 * The message for a text that is not a token.
	 */
	public static function badTokenMessage(): string {
		return __( 'That does not look like a HubSpot private app access token. It starts with pat- and has no spaces.', 'subtleforms' );
	}

	/**
	 * Request headers that sign in.
	 *
	 * @return array<string,string>
	 */
	private function headers(): array {
		return array( 'Authorization' => 'Bearer ' . $this->token );
	}

	/**
	 * Send a request.
	 *
	 * @param array $request Method, url, headers and an optional array body.
	 * @return array{status:int,body:array}
	 * @throws ServiceException On a transport error or an answer that is not 2xx.
	 */
	public function send( array $request ): array {
		$method  = strtoupper( (string) ( $request['method'] ?? 'GET' ) );
		$headers = is_array( $request['headers'] ?? null ) ? $request['headers'] : array();
		$body    = $request['body'] ?? null;

		$headers['Accept'] = 'application/json';
		$args              = array(
			'method'      => $method,
			'headers'     => $headers,
			'timeout'     => $this->timeout,
			'redirection' => 0,
			'user-agent'  => 'SubtleForms/' . ( defined( 'SUBTLEFORMS_VERSION' ) ? SUBTLEFORMS_VERSION : '2' ) . '; ' . home_url( '/' ),
		);
		if ( is_array( $body ) && 'GET' !== $method ) {
			$args['body']                    = wp_json_encode( $body );
			$args['headers']['Content-Type'] = 'application/json';
		}

		$response = wp_safe_remote_request( (string) $request['url'], $args );
		if ( is_wp_error( $response ) ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException(
				sprintf(
					/* translators: %s: error text from the connection */
					__( 'Could not reach HubSpot: %s', 'subtleforms' ),
					$response->get_error_message()
				),
				0,
				true
			);
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		$status  = (int) wp_remote_retrieve_response_code( $response );
		$raw     = (string) wp_remote_retrieve_body( $response );
		$decoded = '' !== $raw ? json_decode( $raw, true ) : array();
		$decoded = is_array( $decoded ) ? $decoded : array();

		if ( $status < 200 || $status >= 300 ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( self::errorMessage( $status, $decoded ), $status, 429 === $status || $status >= 500 );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		return array(
			'status' => $status,
			'body'   => $decoded,
		);
	}

	/**
	 * A plain sentence for an error answer.
	 *
	 * @param int   $status  HTTP status.
	 * @param array $decoded Decoded body.
	 */
	public static function errorMessage( int $status, array $decoded ): string {
		if ( 401 === $status ) {
			return __( 'HubSpot did not accept this access token.', 'subtleforms' );
		}
		$detail = wp_strip_all_tags( (string) ( $decoded['message'] ?? '' ) );
		if ( 403 === $status ) {
			return '' !== $detail
				/* translators: %s: text from HubSpot */
				? sprintf( __( 'HubSpot refused the request, the private app may be missing a scope: %s', 'subtleforms' ), $detail )
				: __( 'HubSpot refused the request, the private app may be missing a scope.', 'subtleforms' );
		}
		if ( '' === $detail ) {
			/* translators: %d: HTTP status code */
			return sprintf( __( 'HubSpot answered with an error (HTTP %d).', 'subtleforms' ), $status );
		}
		/* translators: 1: HTTP status code, 2: text from HubSpot */
		return sprintf( __( 'HubSpot said (HTTP %1$d): %2$s', 'subtleforms' ), $status, $detail );
	}

	/**
	 * Check the token and read the account's portal.
	 *
	 * The account details need no extra scope on a private app. When HubSpot
	 * refuses them, a read of the contact properties still proves the token
	 * works (and the contact scope is there), and the name is left empty.
	 *
	 * @return array{name:string,email:string,portal_id:string,label:string}
	 * @throws ServiceException When HubSpot refuses the token.
	 */
	public function account(): array {
		try {
			$res    = $this->send(
				array(
					'method'  => 'GET',
					'url'     => self::BASE . '/account-info/v3/details',
					'headers' => $this->headers(),
				)
			);
			$portal = (string) ( $res['body']['portalId'] ?? '' );
			$name   = (string) ( $res['body']['companyName'] ?? $res['body']['accountName'] ?? '' );
			if ( '' === $name && '' !== $portal ) {
				/* translators: %s: HubSpot account (portal) ID */
				$name = sprintf( __( 'HubSpot account %s', 'subtleforms' ), $portal );
			}
			return array(
				'name'      => $name,
				'email'     => '',
				'portal_id' => $portal,
				// What the screens show: the name with the portal ID, so two accounts are told apart.
				'label'     => '' !== $name && '' !== $portal && false === strpos( $name, $portal ) ? sprintf( '%s (%s)', $name, $portal ) : $name,
			);
		} catch ( ServiceException $e ) {
			if ( 401 === $e->status() || 0 === $e->status() || $e->isRetryable() ) {
				throw $e;
			}
		}
		// Contact scope check: any answer other than 2xx throws.
		$this->properties();
		return array(
			'name'      => '',
			'email'     => '',
			'portal_id' => '',
			'label'     => '',
		);
	}

	/**
	 * Contact properties a form field can be mapped to: the ones a person can
	 * write, without the five this plugin maps itself.
	 *
	 * @return array<int,array{name:string,label:string}>
	 * @throws ServiceException When HubSpot refuses.
	 */
	public function properties(): array {
		$res = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/crm/v3/properties/contacts?archived=false',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $res['body']['results'] ?? array() ) as $prop ) {
			$name = (string) ( $prop['name'] ?? '' );
			if ( '' === $name || in_array( $name, self::SKIP_PROPERTIES, true ) ) {
				continue;
			}
			if ( ! empty( $prop['modificationMetadata']['readOnlyValue'] ) || ! empty( $prop['calculated'] ) || ! empty( $prop['hidden'] ) ) {
				continue;
			}
			$out[] = array(
				'name'  => $name,
				'label' => (string) ( $prop['label'] ?? $name ),
			);
		}
		usort(
			$out,
			static function ( $a, $b ) {
				return strcasecmp( $a['label'], $b['label'] );
			}
		);
		return $out;
	}

	/**
	 * Properties to write for a contact. Add-ons change them through the body
	 * filter; the email is always the contact's own.
	 *
	 * @param Contact $contact Contact.
	 * @param array   $types   Property name => { type, fieldType } from HubSpot (see propertyTypes()). A property that is not listed is sent as text.
	 * @return array<string,string>
	 */
	public static function propertiesFor( Contact $contact, array $types = array() ): array {
		$props = array( 'email' => $contact->email );
		$known = array(
			'firstname' => $contact->firstName,
			'lastname'  => $contact->lastName,
			'phone'     => $contact->phone,
			'company'   => $contact->company,
		);
		foreach ( $known as $name => $value ) {
			if ( '' !== $value ) {
				$props[ $name ] = $value;
			}
		}
		foreach ( $contact->properties as $name => $value ) {
			$name = strtolower( trim( (string) $name ) );
			if ( '' !== $name && 'email' !== $name && '' !== (string) $value ) {
				$props[ $name ] = self::typed( (string) $value, $types[ $name ] ?? array() );
			}
		}
		return $props;
	}

	/**
	 * The answer in the form HubSpot wants for the property's type: `true` or
	 * `false` for a single checkbox, digits for a number, and a semicolon list
	 * for a multiple checkbox. Anything else is sent as the text it is.
	 *
	 * @param string $value Answer as text (several choices are joined by a comma).
	 * @param array  $type  { type, fieldType } of the property.
	 */
	public static function typed( string $value, array $type ): string {
		$kind  = (string) ( $type['type'] ?? '' );
		$field = (string) ( $type['fieldType'] ?? '' );
		if ( 'bool' === $kind ) {
			return in_array( strtolower( trim( $value ) ), array( '1', 'true', 'yes', 'on', 'checked', 'y' ), true ) ? 'true' : 'false';
		}
		if ( 'number' === $kind ) {
			$number = preg_replace( '/[^0-9.\-]/', '', str_replace( ',', '', $value ) );
			return is_string( $number ) && '' !== $number ? $number : $value;
		}
		if ( 'enumeration' === $kind && 'checkbox' === $field ) {
			$parts = array_filter( array_map( 'trim', explode( ',', $value ) ), 'strlen' );
			return implode( ';', $parts );
		}
		return $value;
	}

	/**
	 * Type and field type of every writable contact property, kept for an hour
	 * so a send does not ask each time. An empty list when HubSpot cannot be
	 * reached: the values are then sent as text and HubSpot says what it
	 * thinks.
	 *
	 * @return array<string,array{type:string,fieldType:string}>
	 */
	public function propertyTypes(): array {
		$key    = 'subtleforms_hs_types_' . md5( $this->token );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		try {
			$res = $this->send(
				array(
					'method'  => 'GET',
					'url'     => self::BASE . '/crm/v3/properties/contacts?archived=false',
					'headers' => $this->headers(),
				)
			);
		} catch ( ServiceException $e ) {
			return array();
		}
		$out = array();
		foreach ( (array) ( $res['body']['results'] ?? array() ) as $prop ) {
			$name = (string) ( $prop['name'] ?? '' );
			if ( '' !== $name ) {
				$out[ $name ] = array(
					'type'      => (string) ( $prop['type'] ?? '' ),
					'fieldType' => (string) ( $prop['fieldType'] ?? '' ),
				);
			}
		}
		set_transient( $key, $out, HOUR_IN_SECONDS );
		return $out;
	}

	/**
	 * Create or update a contact by email.
	 *
	 * With "update existing" on, one batch upsert (HubSpot keeps email unique,
	 * so it creates or updates). With it off, a create: a known address answers
	 * 409 and the contact is left alone.
	 *
	 * @param Contact       $contact Contact.
	 * @param callable|null $filter  Receives the request body, returns it changed.
	 * @return array{id:string,result:string} `result` is created, updated or exists.
	 * @throws ServiceException When HubSpot refuses.
	 */
	public function saveContact( Contact $contact, ?callable $filter = null ): array {
		$props = self::propertiesFor( $contact, array() !== $contact->properties ? $this->propertyTypes() : array() );

		if ( $contact->updateExisting ) {
			$body = array(
				'inputs' => array(
					array(
						'idProperty' => 'email',
						'id'         => $contact->email,
						'properties' => $props,
					),
				),
			);
			$res  = $this->send(
				array(
					'method'  => 'POST',
					'url'     => self::BASE . '/crm/v3/objects/contacts/batch/upsert',
					'headers' => $this->headers(),
					'body'    => self::filtered( $body, $filter ),
				)
			);
			$record = $res['body']['results'][0] ?? array();
			$id     = (string) ( $record['id'] ?? '' );
			// A batch upsert answers 207 with an errors list when a record failed.
			$errors = is_array( $res['body']['errors'] ?? null ) ? $res['body']['errors'] : array();
			if ( array() !== $errors || '' === $id ) {
				$first  = reset( $errors );
				$detail = is_array( $first ) ? (string) ( $first['message'] ?? '' ) : '';
				// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
				throw new ServiceException(
					'' !== $detail
						/* translators: %s: text from HubSpot */
						? sprintf( __( 'HubSpot did not save the contact: %s', 'subtleforms' ), wp_strip_all_tags( $detail ) )
						: __( 'HubSpot did not save the contact.', 'subtleforms' ),
					(int) $res['status'],
					false
				);
				// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
			return array(
				'id'     => $id,
				'result' => ! empty( $record['new'] ) ? 'created' : 'updated',
			);
		}

		try {
			$res = $this->send(
				array(
					'method'  => 'POST',
					'url'     => self::BASE . '/crm/v3/objects/contacts',
					'headers' => $this->headers(),
					'body'    => self::filtered( array( 'properties' => $props ), $filter ),
				)
			);
		} catch ( ServiceException $e ) {
			if ( 409 !== $e->status() ) {
				throw $e;
			}
			// HubSpot names the existing record: "Existing ID: 123".
			$existing = 1 === preg_match( '/Existing ID:\s*(\d+)/i', $e->getMessage(), $m ) ? $m[1] : '';
			return array(
				'id'     => $existing,
				'result' => 'exists',
			);
		}
		return array(
			'id'     => (string) ( $res['body']['id'] ?? '' ),
			'result' => 'created',
		);
	}

	/**
	 * Run the add-on's body filter, if there is one.
	 *
	 * @param array         $body   Request body.
	 * @param callable|null $filter Filter.
	 */
	private static function filtered( array $body, ?callable $filter ): array {
		if ( null === $filter ) {
			return $body;
		}
		$changed = $filter( $body );
		return is_array( $changed ) ? $changed : $body;
	}
}
