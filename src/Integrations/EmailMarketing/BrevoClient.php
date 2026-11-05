<?php
/**
 * Brevo (formerly Sendinblue) API v3 client.
 *
 * Docs: https://developers.brevo.com/reference/createcontact
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
 * Creates or updates a contact with POST /v3/contacts and `updateEnabled`, so
 * the same email address is never added twice. With double opt-in on, a new
 * contact goes through POST /v3/contacts/doubleOptinConfirmation instead:
 * Brevo emails the template the site owner chose and adds the contact to the
 * list when they confirm.
 */
final class BrevoClient extends AbstractClient {

	const BASE = 'https://api.brevo.com/v3';

	public static function serviceLabel(): string {
		return 'Brevo';
	}

	/**
	 * Brevo API (v3) keys start with "xkeysib-". The SMTP password of an
	 * account ("xsmtpsib-") is not an API key.
	 *
	 * @param string $key Key.
	 */
	public static function looksLikeKey( string $key ): bool {
		$key = trim( $key );
		return 1 === preg_match( '/^xkeysib-[A-Za-z0-9_-]{16,}$/', $key );
	}

	/**
	 * The sentence for a key that is not a Brevo API key.
	 */
	public static function badKeyMessage(): string {
		return __( 'This does not look like a Brevo API key. Create a v3 API key under SMTP & API, API keys; it starts with "xkeysib-". The SMTP password does not work here.', 'subtleforms' );
	}

	protected function headers(): array {
		return array( 'api-key' => $this->apiKey );
	}

	protected function errorDetail( array $decoded ): string {
		return isset( $decoded['message'] ) && is_string( $decoded['message'] ) ? $decoded['message'] : '';
	}

	/**
	 * Attribute names are upper case in Brevo (FIRSTNAME, LASTNAME, SMS...).
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array<string,string>
	 */
	private function attributes( Subscriber $sub ): array {
		$attributes = array();
		if ( '' !== $sub->firstName ) {
			$attributes['FIRSTNAME'] = $sub->firstName;
		}
		if ( '' !== $sub->lastName ) {
			$attributes['LASTNAME'] = $sub->lastName;
		}
		foreach ( $sub->fields as $name => $value ) {
			$attributes[ strtoupper( (string) $name ) ] = $value;
		}
		return $attributes;
	}

	/**
	 * The create-or-update request.
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function upsertRequest( Subscriber $sub ): array {
		$body = array(
			'email'         => $sub->email,
			'updateEnabled' => true,
		);
		$attributes = $this->attributes( $sub );
		if ( $attributes ) {
			$body['attributes'] = $attributes;
		}
		if ( ctype_digit( $sub->listId ) && '' !== $sub->listId ) {
			$body['listIds'] = array( (int) $sub->listId );
		}
		return array(
			'method'  => 'POST',
			'url'     => self::BASE . '/contacts',
			'headers' => $this->headers(),
			'body'    => $body,
		);
	}

	/**
	 * The double opt-in request: Brevo sends the confirmation email.
	 *
	 * @param Subscriber $sub Subscriber.
	 * @return array{method:string,url:string,headers:array,body:array}
	 */
	public function doubleOptInRequest( Subscriber $sub ): array {
		$body = array(
			'email'          => $sub->email,
			'includeListIds' => array( (int) $sub->listId ),
			'templateId'     => (int) ( $this->settings['doi_template_id'] ?? 0 ),
			'redirectionUrl' => (string) ( $this->settings['doi_redirect_url'] ?? '' ),
		);
		$attributes = $this->attributes( $sub );
		if ( $attributes ) {
			$body['attributes'] = $attributes;
		}
		return array(
			'method'  => 'POST',
			'url'     => self::BASE . '/contacts/doubleOptinConfirmation',
			'headers' => $this->headers(),
			'body'    => $body,
		);
	}

	public function subscribe( Subscriber $sub, ?callable $bodyFilter = null ): array {
		if ( '' !== $sub->listId && ! ctype_digit( $sub->listId ) ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( __( 'Brevo list IDs are numbers. Choose the list again in the form\'s Brevo settings.', 'subtleforms' ) );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		if ( $sub->doubleOptIn ) {
			if ( '' === $sub->listId ) {
				// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
				throw new ServiceException( __( 'Double opt-in needs a list. Choose one in the form\'s Brevo settings.', 'subtleforms' ) );
				// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
			if ( (int) ( $this->settings['doi_template_id'] ?? 0 ) <= 0 || '' === (string) ( $this->settings['doi_redirect_url'] ?? '' ) ) {
				// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
				throw new ServiceException( __( 'Double opt-in needs a template and a redirect page. Choose them under Settings > Integrations > Email marketing > Brevo.', 'subtleforms' ) );
				// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
			// A person Brevo already knows is updated, not asked again.
			if ( ! $this->contactExists( $sub->email ) ) {
				$request         = $this->doubleOptInRequest( $sub );
				$request['body'] = self::filtered( $request['body'], $bodyFilter );
				$this->send( $request );
				return array(
					'status' => 'pending',
					'member' => '',
					'notes'  => array(),
				);
			}
		}

		$request         = $this->upsertRequest( $sub );
		$request['body'] = self::filtered( $request['body'], $bodyFilter );
		$response        = $this->send( $request );
		return array(
			'status' => 201 === $response['status'] ? 'subscribed' : 'updated',
			'member' => isset( $response['body']['id'] ) ? (string) $response['body']['id'] : '',
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
		$name = trim( (string) ( $response['body']['companyName'] ?? '' ) );
		if ( '' === $name ) {
			$name = trim( (string) ( $response['body']['firstName'] ?? '' ) . ' ' . (string) ( $response['body']['lastName'] ?? '' ) );
		}
		return array(
			'name'  => $name,
			'email' => (string) ( $response['body']['email'] ?? '' ),
		);
	}

	public function lists(): array {
		$out = array();
		for ( $offset = 0; $offset < 200; $offset += 50 ) {
			$response = $this->send(
				array(
					'method'  => 'GET',
					'url'     => self::BASE . '/contacts/lists?limit=50&offset=' . $offset . '&sort=desc',
					'headers' => $this->headers(),
				)
			);
			$lists = (array) ( $response['body']['lists'] ?? array() );
			foreach ( $lists as $list ) {
				if ( ! is_array( $list ) || ! isset( $list['id'] ) ) {
					continue;
				}
				$out[] = array(
					'id'    => (string) $list['id'],
					'name'  => (string) ( $list['name'] ?? $list['id'] ),
					'count' => isset( $list['uniqueSubscribers'] ) ? (int) $list['uniqueSubscribers'] : ( isset( $list['totalSubscribers'] ) ? (int) $list['totalSubscribers'] : null ),
				);
			}
			if ( count( $lists ) < 50 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * Contact attributes of the account (not the first and last name, which
	 * have their own rows, and not calculated or system attributes).
	 *
	 * @param string $listId Ignored: Brevo attributes belong to the account.
	 */
	public function fields( string $listId ): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/contacts/attributes',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $response['body']['attributes'] ?? array() ) as $attribute ) {
			$name = is_array( $attribute ) ? (string) ( $attribute['name'] ?? '' ) : '';
			if ( '' === $name || 'normal' !== ( $attribute['category'] ?? 'normal' ) || in_array( strtoupper( $name ), array( 'FIRSTNAME', 'LASTNAME' ), true ) ) {
				continue;
			}
			$out[] = array(
				'tag'      => $name,
				'name'     => ucwords( strtolower( str_replace( '_', ' ', $name ) ) ),
				'type'     => (string) ( $attribute['type'] ?? 'text' ),
				'required' => false,
			);
		}
		return $out;
	}

	/**
	 * The templates the double opt-in email can use.
	 *
	 * @return array<int,array{id:string,name:string}>
	 * @throws ServiceException On an error answer.
	 */
	public function templates(): array {
		$response = $this->send(
			array(
				'method'  => 'GET',
				'url'     => self::BASE . '/smtp/templates?templateStatus=true&limit=100&offset=0&sort=desc',
				'headers' => $this->headers(),
			)
		);
		$out = array();
		foreach ( (array) ( $response['body']['templates'] ?? array() ) as $template ) {
			if ( is_array( $template ) && isset( $template['id'] ) ) {
				$out[] = array(
					'id'   => (string) $template['id'],
					'name' => (string) ( $template['name'] ?? $template['id'] ),
				);
			}
		}
		return $out;
	}

	/**
	 * Whether Brevo has a contact with this address.
	 *
	 * @param string $email Email address.
	 * @param int[]|null $listIds Filled with the lists the contact is on.
	 * @throws ServiceException On an error answer other than "not found".
	 */
	private function contactExists( string $email, ?array &$listIds = null ): bool {
		try {
			$response = $this->send(
				array(
					'method'  => 'GET',
					'url'     => self::BASE . '/contacts/' . rawurlencode( self::normalizeEmail( $email ) ) . '?identifierType=email_id',
					'headers' => $this->headers(),
				)
			);
		} catch ( ServiceException $e ) {
			if ( 404 === $e->status() ) {
				return false;
			}
			throw $e;
		}
		$listIds = array_map( 'intval', (array) ( $response['body']['listIds'] ?? array() ) );
		return true;
	}

	public function isMember( string $listId, string $email ): bool {
		$lists = array();
		if ( ! $this->contactExists( $email, $lists ) ) {
			return false;
		}
		return '' === $listId || ! ctype_digit( $listId ) || in_array( (int) $listId, (array) $lists, true );
	}
}
