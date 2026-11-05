<?php
/**
 * Kit (formerly ConvertKit) API v4 client.
 *
 * Docs: https://developers.kit.com/api-reference/subscribers/create-a-subscriber
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
 * Creates (upserts) a subscriber by email address, adds them to a Kit form
 * and applies tags. Kit's API has no double opt-in switch, so people are
 * added as active subscribers.
 */
final class KitClient extends AbstractClient {

	const BASE = 'https://api.kit.com/v4';

	public static function serviceLabel(): string {
		return 'Kit';
	}

	/**
	 * Kit API keys are one run of letters, digits, dashes and underscores.
	 *
	 * @param string $key Key.
	 */
	public static function looksLikeKey( string $key ): bool {
		return 1 === preg_match( '/^[A-Za-z0-9_-]{16,}$/', trim( $key ) );
	}

	/**
	 * The sentence for a key that is not a Kit API key.
	 */
	public static function badKeyMessage(): string {
		return __( 'This does not look like a Kit API key. In Kit, open Settings, Developer, and create a v4 API key.', 'subtleforms' );
	}

	protected function headers(): array {
		return array( 'X-Kit-Api-Key' => $this->apiKey );
	}

	protected function errorDetail( array $decoded ): string {
		if ( isset( $decoded['errors'] ) && is_array( $decoded['errors'] ) ) {
			return implode( ' ', array_filter( array_map( 'strval', $decoded['errors'] ) ) );
		}
		foreach ( array( 'message', 'error' ) as $key ) {
			if ( ! empty( $decoded[ $key ] ) && is_string( $decoded[ $key ] ) ) {
				return $decoded[ $key ];
			}
		}
		return '';
	}

	/**
	 * Create-or-update subscriber request.
	 *
	 * Kit has no built-in last name. It is sent as the custom field
	 * `last_name` only when the form maps it by hand, because a custom field
	 * the account does not have is not stored.
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function createRequest( Subscriber $sub ): array {
		$body = array( 'email_address' => $sub->email );
		if ( '' !== $sub->firstName ) {
			$body['first_name'] = $sub->firstName;
		}
		$fields = $sub->fields;
		if ( $sub->lastNameMapped && '' !== $sub->lastName && ! isset( $fields['last_name'] ) ) {
			$fields['last_name'] = $sub->lastName;
		}
		if ( $fields ) {
			$body['fields'] = (object) $fields;
		}
		return array(
			'method'  => 'POST',
			'url'     => self::BASE . '/subscribers',
			'headers' => $this->headers(),
			'body'    => $body,
		);
	}

	/**
	 * Add the subscriber to a Kit form.
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function formRequest( Subscriber $sub ): array {
		return array(
			'method'  => 'POST',
			'url'     => self::BASE . '/forms/' . rawurlencode( $sub->listId ) . '/subscribers',
			'headers' => $this->headers(),
			'body'    => array( 'email_address' => $sub->email ),
		);
	}

	/**
	 * Create a tag (Kit answers with the existing tag when the name is taken).
	 *
	 * @param string $name Tag name.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function tagCreateRequest( string $name ): array {
		return array(
			'method'  => 'POST',
			'url'     => self::BASE . '/tags',
			'headers' => $this->headers(),
			'body'    => array( 'name' => $name ),
		);
	}

	/**
	 * Tag the subscriber.
	 *
	 * @param string $tagId Tag ID.
	 * @param string $email Email.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function tagRequest( string $tagId, string $email ): array {
		return array(
			'method'  => 'POST',
			'url'     => self::BASE . '/tags/' . rawurlencode( $tagId ) . '/subscribers',
			'headers' => $this->headers(),
			'body'    => array( 'email_address' => $email ),
		);
	}

	public function subscribe( Subscriber $sub, ?callable $bodyFilter = null ): array {
		$request         = $this->createRequest( $sub );
		$request['body'] = self::filtered( $request['body'], $bodyFilter );
		$response        = $this->send( $request );

		$member = (string) ( $response['body']['subscriber']['id'] ?? '' );
		$status = 200 === $response['status'] ? 'updated' : 'subscribed';

		if ( '' !== $sub->listId ) {
			$this->send( $this->formRequest( $sub ) );
		}
		foreach ( $sub->tags as $tag ) {
			$created = $this->send( $this->tagCreateRequest( $tag ) );
			$tagId   = (string) ( $created['body']['tag']['id'] ?? '' );
			if ( '' !== $tagId ) {
				$this->send( $this->tagRequest( $tagId, $sub->email ) );
			}
		}
		return array(
			'status' => $status,
			'member' => $member,
			'notes'  => array(),
		);
	}

	public function account(): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/account',
				'headers' => $this->headers(),
			)
		);
		$account = is_array( $response['body']['account'] ?? null ) ? $response['body']['account'] : array();
		$user    = is_array( $response['body']['user'] ?? null ) ? $response['body']['user'] : array();
		return array(
			'name'  => (string) ( $account['name'] ?? '' ),
			'email' => (string) ( $user['email'] ?? $account['primary_email_address'] ?? '' ),
		);
	}

	/**
	 * Kit forms (the "list" a subscriber joins).
	 */
	public function lists(): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/forms?status=active&per_page=500',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $response['body']['forms'] ?? array() ) as $form ) {
			if ( is_array( $form ) && isset( $form['id'] ) ) {
				$out[] = array(
					'id'    => (string) $form['id'],
					'name'  => (string) ( $form['name'] ?? $form['id'] ),
					'count' => null,
				);
			}
		}
		return $out;
	}

	/**
	 * Custom fields of the account, except `last_name`, which has its own row.
	 *
	 * @param string $listId Ignored: Kit custom fields belong to the account.
	 */
	public function fields( string $listId ): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/custom_fields?per_page=100',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $response['body']['custom_fields'] ?? array() ) as $field ) {
			$key = is_array( $field ) ? (string) ( $field['key'] ?? '' ) : '';
			if ( '' === $key || 'last_name' === $key ) {
				continue;
			}
			$out[] = array(
				'tag'      => $key,
				'name'     => (string) ( $field['label'] ?? $key ),
				'type'     => 'text',
				'required' => false,
			);
		}
		return $out;
	}

	public function isMember( string $listId, string $email ): bool {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/subscribers?email_address=' . rawurlencode( self::normalizeEmail( $email ) ) . '&status=all&per_page=1',
				'headers' => $this->headers(),
			)
		);
		return ! empty( $response['body']['subscribers'] );
	}
}
