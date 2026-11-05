<?php
/**
 * Mailchimp Marketing API v3 client.
 *
 * Docs: https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/
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
 * Adds or updates one audience member by the MD5 of the email address, so
 * the same person is never added twice.
 */
final class MailchimpClient extends AbstractClient {

	public static function serviceLabel(): string {
		return 'Mailchimp';
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
	 * @throws ServiceException When the key has no data center suffix.
	 */
	public function baseUrl(): string {
		$dash = strrpos( $this->apiKey, '-' );
		$dc   = false === $dash ? '' : substr( $this->apiKey, $dash + 1 );
		if ( '' === $dc || 1 !== preg_match( '/^[a-z]+[0-9]+$/', $dc ) ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( self::badKeyMessage() );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		return 'https://' . $dc . '.api.mailchimp.com/3.0';
	}

	/**
	 * The sentence for a key that is not a Mailchimp key.
	 */
	public static function badKeyMessage(): string {
		return __( 'This does not look like a Mailchimp API key. Keys end with a dash and the data center, for example "-us21".', 'subtleforms' );
	}

	/**
	 * Request headers (HTTP Basic auth: any user name, the key as password).
	 *
	 * @return array<string,string>
	 */
	protected function headers(): array {
		return array(
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- HTTP Basic credentials, as the Mailchimp API requires.
			'Authorization' => 'Basic ' . base64_encode( 'subtleforms:' . $this->apiKey ),
		);
	}

	protected function errorDetail( array $decoded ): string {
		foreach ( array( 'detail', 'title' ) as $key ) {
			if ( ! empty( $decoded[ $key ] ) && is_string( $decoded[ $key ] ) ) {
				return $decoded[ $key ];
			}
		}
		return '';
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
	 * @throws ServiceException When the key is not a Mailchimp key.
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

	public function subscribe( Subscriber $sub, ?callable $bodyFilter = null ): array {
		$request         = $this->upsertRequest( $sub );
		$request['body'] = self::filtered( $request['body'], $bodyFilter );
		$response        = $this->send( $request );
		$status          = (string) ( $response['body']['status'] ?? '' );
		if ( $sub->tags ) {
			$this->send( $this->tagsRequest( $sub ) );
		}
		return array(
			'status' => '' === $status ? 'subscribed' : $status,
			'member' => (string) ( $response['body']['id'] ?? self::subscriberHash( $sub->email ) ),
			'notes'  => array(),
		);
	}

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

	public function lists(): array {
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
	 */
	public function fields( string $listId ): array {
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
		} catch ( ServiceException $e ) {
			if ( 404 === $e->status() ) {
				return false;
			}
			throw $e;
		}
	}
}
