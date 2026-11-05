<?php
/**
 * Mailchimp Marketing API v3 client.
 *
 * Docs: https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/
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
 * Builds and sends the requests. Requests are plain arrays (method, url,
 * headers, body) so they can be checked without a network.
 */
final class Client {

	/** Seconds to wait for Mailchimp when a person is waiting in wp-admin. */
	const ADMIN_TIMEOUT = 10;

	/** Seconds to wait for Mailchimp in the background job. */
	const JOB_TIMEOUT = 15;

	/** @var string */
	private string $apiKey;

	/** @var int */
	private int $timeout;

	/**
	 * @param string $apiKey  API key, ending in the data center (for example "-us21").
	 * @param int    $timeout Seconds.
	 */
	public function __construct( string $apiKey, int $timeout = self::ADMIN_TIMEOUT ) {
		$this->apiKey  = trim( $apiKey );
		$this->timeout = max( 3, $timeout );
	}

	/**
	 * Whether a string has the shape of an API key.
	 *
	 * @param string $key Key.
	 */
	public static function looksLikeKey( string $key ): bool {
		return 1 === preg_match( '/^[A-Za-z0-9]{8,}-[a-z]+[0-9]+$/', trim( $key ) );
	}

	/**
	 * API root for the key's data center.
	 *
	 * @throws MailchimpException When the key has no data center suffix.
	 */
	public function baseUrl(): string {
		$dash = strrpos( $this->apiKey, '-' );
		$dc   = false === $dash ? '' : substr( $this->apiKey, $dash + 1 );
		if ( '' === $dc || 1 !== preg_match( '/^[a-z]+[0-9]+$/', $dc ) ) {
			throw new MailchimpException( __( 'This does not look like a Mailchimp API key. Keys end with a dash and the data center, for example "-us21".', 'subtleforms' ) );
		}
		return 'https://' . $dc . '.api.mailchimp.com/3.0';
	}

	/**
	 * Request headers (HTTP Basic auth: any user name, the key as password).
	 *
	 * @return array<string,string>
	 */
	private function headers(): array {
		return array(
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- HTTP Basic credentials, as the Mailchimp API requires.
			'Authorization' => 'Basic ' . base64_encode( 'subtleforms:' . $this->apiKey ),
		);
	}

	/**
	 * MD5 of the lowercase email, which is Mailchimp's member ID.
	 *
	 * @param string $email Email address.
	 */
	public static function subscriberHash( string $email ): string {
		return md5( strtolower( trim( $email ) ) );
	}

	/**
	 * The members URL of one person in one audience.
	 *
	 * @param string $listId Audience ID.
	 * @param string $email  Email address.
	 * @throws MailchimpException When the key is not a Mailchimp key.
	 */
	private function memberUrl( string $listId, string $email ): string {
		return $this->baseUrl() . '/lists/' . rawurlencode( $listId ) . '/members/' . self::subscriberHash( $email );
	}

	/**
	 * The add-or-update request for a subscriber.
	 *
	 * `status_if_new` only applies to a new member: someone who unsubscribed
	 * is not subscribed again by filling in a form.
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function upsertRequest( Subscriber $sub ): array {
		$merge = array();
		if ( '' !== $sub->firstName ) {
			$merge['FNAME'] = $sub->firstName;
		}
		if ( '' !== $sub->lastName ) {
			$merge['LNAME'] = $sub->lastName;
		}
		foreach ( $sub->fields as $tag => $value ) {
			$merge[ strtoupper( (string) $tag ) ] = $value;
		}

		$body = array(
			'email_address' => $sub->email,
			'status_if_new' => $sub->doubleOptIn ? 'pending' : 'subscribed',
		);
		if ( $merge ) {
			$body['merge_fields'] = $merge;
		}

		return array(
			'method'  => 'PUT',
			'url'     => $this->memberUrl( $sub->listId, $sub->email ) . '?skip_merge_validation=true',
			'headers' => $this->headers(),
			'body'    => $body,
		);
	}

	/**
	 * The request that adds tags to a member. Tags in the add-or-update body
	 * only reach new members, so tags always go through this endpoint.
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function tagsRequest( Subscriber $sub ): array {
		$tags = array();
		foreach ( $sub->tags as $tag ) {
			$tags[] = array(
				'name'   => $tag,
				'status' => 'active',
			);
		}
		return array(
			'method'  => 'POST',
			'url'     => $this->memberUrl( $sub->listId, $sub->email ) . '/tags',
			'headers' => $this->headers(),
			'body'    => array( 'tags' => $tags ),
		);
	}

	/**
	 * Send a request.
	 *
	 * @param array $request Method, url, headers and an optional array body.
	 * @return array{status:int,body:array}
	 * @throws MailchimpException On a transport error or an answer that is not 2xx.
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
			$args['body']            = wp_json_encode( $body );
			$args['headers']['Content-Type'] = 'application/json';
		}

		// The safe client refuses private addresses and unusual ports; the
		// only host this class calls is <data center>.api.mailchimp.com.
		$response = wp_safe_remote_request( (string) $request['url'], $args );
		if ( is_wp_error( $response ) ) {
			throw new MailchimpException(
				sprintf(
					/* translators: %s: error text from the connection */
					__( 'Could not reach Mailchimp: %s', 'subtleforms' ),
					$response->get_error_message()
				),
				0,
				true
			);
		}

		$status  = (int) wp_remote_retrieve_response_code( $response );
		$raw     = (string) wp_remote_retrieve_body( $response );
		$decoded = '' !== $raw ? json_decode( $raw, true ) : array();
		$decoded = is_array( $decoded ) ? $decoded : array();

		if ( $status < 200 || $status >= 300 ) {
			throw new MailchimpException( self::errorMessage( $status, $decoded ), $status, 429 === $status || $status >= 500 );
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
		if ( 401 === $status || 403 === $status ) {
			return __( 'Mailchimp did not accept this API key.', 'subtleforms' );
		}
		$detail = '';
		foreach ( array( 'detail', 'title' ) as $key ) {
			if ( ! empty( $decoded[ $key ] ) && is_string( $decoded[ $key ] ) ) {
				$detail = wp_strip_all_tags( $decoded[ $key ] );
				break;
			}
		}
		if ( '' === $detail ) {
			/* translators: %d: HTTP status code */
			return sprintf( __( 'Mailchimp answered with an error (HTTP %d).', 'subtleforms' ), $status );
		}
		/* translators: 1: HTTP status code, 2: text from Mailchimp */
		return sprintf( __( 'Mailchimp said (HTTP %1$d): %2$s', 'subtleforms' ), $status, $detail );
	}

	/**
	 * Check the key and read the account behind it.
	 *
	 * @return array{name:string,email:string}
	 * @throws MailchimpException When the key is refused or Mailchimp cannot be reached.
	 */
	public function account(): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => $this->baseUrl() . '/?fields=account_name,email',
				'headers' => $this->headers(),
			)
		);
		return array(
			'name'  => (string) ( $response['body']['account_name'] ?? '' ),
			'email' => (string) ( $response['body']['email'] ?? '' ),
		);
	}

	/**
	 * The audiences of the account.
	 *
	 * @return array<int,array{id:string,name:string,count:?int}>
	 * @throws MailchimpException On an error answer.
	 */
	public function audiences(): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => $this->baseUrl() . '/lists?count=200&fields=lists.id,lists.name,lists.stats.member_count',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $response['body']['lists'] ?? array() ) as $list ) {
			if ( ! is_array( $list ) || empty( $list['id'] ) ) {
				continue;
			}
			$out[] = array(
				'id'    => (string) $list['id'],
				'name'  => (string) ( $list['name'] ?? $list['id'] ),
				'count' => isset( $list['stats']['member_count'] ) ? (int) $list['stats']['member_count'] : null,
			);
		}
		return $out;
	}

	/**
	 * Merge fields of an audience, without the email, first name and last
	 * name fields (those have their own rows) and without address fields,
	 * which need a structured value a form answer cannot give.
	 *
	 * @param string $listId Audience ID.
	 * @return array<int,array{tag:string,name:string,type:string,required:bool}>
	 * @throws MailchimpException On an error answer.
	 */
	public function mergeFields( string $listId ): array {
		if ( '' === $listId ) {
			return array();
		}
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => $this->baseUrl() . '/lists/' . rawurlencode( $listId ) . '/merge-fields?count=100&fields=merge_fields.tag,merge_fields.name,merge_fields.type,merge_fields.required',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $response['body']['merge_fields'] ?? array() ) as $field ) {
			$tag  = is_array( $field ) ? (string) ( $field['tag'] ?? '' ) : '';
			$type = is_array( $field ) ? (string) ( $field['type'] ?? 'text' ) : '';
			if ( '' === $tag || in_array( $tag, array( 'EMAIL', 'FNAME', 'LNAME' ), true ) || 'address' === $type ) {
				continue;
			}
			$out[] = array(
				'tag'      => $tag,
				'name'     => (string) ( $field['name'] ?? $tag ),
				'type'     => $type,
				'required' => ! empty( $field['required'] ),
			);
		}
		return $out;
	}

	/**
	 * Whether the person is already a member of the audience.
	 *
	 * @param string $listId Audience ID.
	 * @param string $email  Email address.
	 * @throws MailchimpException On an error answer other than "not found".
	 */
	public function isMember( string $listId, string $email ): bool {
		try {
			$this->send(
				array(
					'method'  => 'GET',
					'url'     => $this->memberUrl( $listId, $email ) . '?fields=id,status',
					'headers' => $this->headers(),
				)
			);
			return true;
		} catch ( MailchimpException $e ) {
			if ( 404 === $e->status() ) {
				return false;
			}
			throw $e;
		}
	}
}
