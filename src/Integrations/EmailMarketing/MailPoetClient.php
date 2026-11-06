<?php
/**
 * MailPoet, through its PHP API on the same site.
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
 * Wraps `\MailPoet\API\API::MP( 'v1' )`. Nothing leaves the server: there is
 * no key, no request to another site and nothing to retry, because the call
 * is local.
 *
 * Methods used (checked by name in MailPoetStatus): getLists,
 * getSubscriberFields, getSubscriber, addSubscriber( $data, $listIds,
 * $options ), subscribeToLists( $idOrEmail, $listIds, $options ),
 * isSetupComplete, and tagSubscriber when an add-on supplies tags and this
 * MailPoet has it.
 *
 * A person MailPoet already has is added to the chosen list. Someone whose
 * status is `unsubscribed` or `bounced` is never subscribed again: the
 * delivery is skipped with a plain line for the entry.
 */
final class MailPoetClient implements ClientInterface {

	/** MailPoet's own exception, thrown for a refusal such as an unknown list. */
	const API_EXCEPTION = '\\MailPoet\\API\\MP\\v1\\APIException';

	/** Code MailPoet gives when it has no such subscriber. */
	const SUBSCRIBER_NOT_EXISTS = 4;

	/** Code MailPoet gives when the subscriber is already there. */
	const SUBSCRIBER_EXISTS = 12;

	/**
	 * Same arguments as the clients that talk to a service; MailPoet needs none.
	 *
	 * @param string $apiKey   Unused.
	 * @param int    $timeout  Unused.
	 * @param array  $settings Unused.
	 */
	public function __construct( string $apiKey = '', int $timeout = 0, array $settings = array() ) {
		unset( $apiKey, $timeout, $settings );
	}

	/**
	 * The service name used in messages.
	 */
	public static function serviceLabel(): string {
		return 'MailPoet';
	}

	/**
	 * MailPoet has no API key.
	 *
	 * @param string $key Key.
	 */
	public static function looksLikeKey( string $key ): bool {
		unset( $key );
		return false;
	}

	/**
	 * What to say when a key is offered for MailPoet.
	 */
	public static function badKeyMessage(): string {
		return __( 'MailPoet is a plugin on this site and has no API key.', 'subtleforms' );
	}

	/**
	 * The v1 API, or an exception that says why it is not there.
	 *
	 * @return object
	 * @throws ServiceException When MailPoet cannot take people.
	 */
	private function api(): object {
		$api = MailPoetStatus::api();
		if ( null === $api ) {
			$reason = MailPoetStatus::reason();
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( '' !== $reason ? $reason : __( 'MailPoet is not available', 'subtleforms' ) );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		return $api;
	}

	/**
	 * MailPoet has no account to read.
	 *
	 * @return array{name:string,email:string}
	 * @throws ServiceException When MailPoet cannot take people.
	 */
	public function account(): array {
		$this->api();
		return array(
			'name'  => 'MailPoet',
			'email' => '',
		);
	}

	/**
	 * MailPoet's lists (the plain lists, not WordPress users or customers).
	 *
	 * @return array<int,array{id:string,name:string,count:?int}>
	 * @throws ServiceException When MailPoet cannot take people or refuses.
	 */
	public function lists(): array {
		$api = $this->api();
		try {
			$rows = $api->getLists();
		} catch ( \Throwable $e ) {
			throw $this->failure( $e ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Caught by Sender and written to the log, never printed.
		}
		$out = array();
		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			if ( ! is_array( $row ) || ! isset( $row['id'] ) ) {
				continue;
			}
			$out[] = array(
				'id'    => (string) $row['id'],
				'name'  => (string) ( $row['name'] ?? $row['id'] ),
				'count' => null,
			);
		}
		return $out;
	}

	/**
	 * MailPoet's custom subscriber fields (ids look like `cf_3`). Email and
	 * the two names have their own rows in the mapping.
	 *
	 * @param string $listId Unused: the fields belong to the site.
	 * @return array<int,array{tag:string,name:string,type:string,required:bool}>
	 * @throws ServiceException When MailPoet cannot take people or refuses.
	 */
	public function fields( string $listId ): array {
		unset( $listId );
		$api = $this->api();
		try {
			$rows = $api->getSubscriberFields();
		} catch ( \Throwable $e ) {
			throw $this->failure( $e ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Caught by Sender and written to the log, never printed.
		}
		$out = array();
		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$id = is_array( $row ) ? (string) ( $row['id'] ?? '' ) : '';
			if ( '' === $id || in_array( $id, array( 'email', 'first_name', 'last_name' ), true ) ) {
				continue;
			}
			$out[] = array(
				'tag'      => $id,
				'name'     => (string) ( $row['name'] ?? $id ),
				'type'     => (string) ( $row['type'] ?? 'text' ),
				'required' => '1' === (string) ( $row['params']['required'] ?? '' ),
			);
		}
		return $out;
	}

	/**
	 * Whether MailPoet has the person on this list.
	 *
	 * @param string $listId List ID.
	 * @param string $email  Email address.
	 * @throws ServiceException When MailPoet cannot take people or refuses.
	 */
	public function isMember( string $listId, string $email ): bool {
		$api = $this->api();
		try {
			$found = $this->find( $api, $email );
		} catch ( \Throwable $e ) {
			throw $this->failure( $e ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Caught by Sender and written to the log, never printed.
		}
		if ( null === $found ) {
			return false;
		}
		foreach ( is_array( $found['subscriptions'] ?? null ) ? $found['subscriptions'] : array() as $subscription ) {
			if ( is_array( $subscription ) && (string) ( $subscription['segment_id'] ?? '' ) === $listId && 'unsubscribed' !== ( $subscription['status'] ?? '' ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Add the person to the list, or add the person MailPoet already has to
	 * it. Unsubscribed and bounced people are skipped.
	 *
	 * @param Subscriber    $sub        Subscriber.
	 * @param callable|null $bodyFilter Receives the subscriber data of a new person and returns it.
	 * @return array{status:string,member:string,notes:string[]} `status` is subscribed, pending (MailPoet waits for the confirmation) or updated.
	 * @throws ServiceSkip      For a person who must not be subscribed again.
	 * @throws ServiceException When MailPoet cannot take people or refuses.
	 */
	public function subscribe( Subscriber $sub, ?callable $bodyFilter = null ): array {
		$api    = $this->api();
		$listId = ctype_digit( $sub->listId ) ? (int) $sub->listId : 0;
		if ( $listId <= 0 ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( __( 'No list is chosen in the form\'s MailPoet settings.', 'subtleforms' ) );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		$options = array(
			'send_confirmation_email' => $sub->sendConfirmation,
			'schedule_welcome_email'  => $sub->welcomeEmail,
		);

		try {
			$existing = $this->find( $api, $sub->email );
			$result   = null;
			$status   = 'updated';

			if ( null === $existing ) {
				$data = $sub->fields;
				if ( '' !== $sub->firstName ) {
					$data['first_name'] = $sub->firstName;
				}
				if ( '' !== $sub->lastName ) {
					$data['last_name'] = $sub->lastName;
				}
				$data['email'] = $sub->email;
				if ( null !== $bodyFilter ) {
					$changed = $bodyFilter( $data );
					$data    = is_array( $changed ) ? $changed : $data;
				}
				try {
					$result = $api->addSubscriber( $data, array( $listId ), $options );
					$status = 'unconfirmed' === strtolower( (string) ( $result['status'] ?? '' ) ) ? 'pending' : 'subscribed';
				} catch ( \Throwable $e ) {
					if ( ! $this->is( $e, self::SUBSCRIBER_EXISTS ) ) {
						throw $e;
					}
					// Someone added the same address a moment ago: treat it as known.
					$existing = $this->find( $api, $sub->email );
					if ( null === $existing ) {
						throw $e;
					}
				}
			}

			if ( null !== $existing ) {
				$current = strtolower( (string) ( $existing['status'] ?? '' ) );
				if ( 'unsubscribed' === $current ) {
					throw new ServiceSkip( __( 'Skipped: previously unsubscribed in MailPoet', 'subtleforms' ), 'previously_unsubscribed' );
				}
				if ( 'bounced' === $current ) {
					throw new ServiceSkip( __( 'Skipped: email bounced in MailPoet', 'subtleforms' ), 'bounced' );
				}
				foreach ( is_array( $existing['subscriptions'] ?? null ) ? $existing['subscriptions'] : array() as $subscription ) {
					if ( is_array( $subscription ) && (string) ( $subscription['segment_id'] ?? '' ) === (string) $listId && 'unsubscribed' === strtolower( (string) ( $subscription['status'] ?? '' ) ) ) {
						throw new ServiceSkip( __( 'Skipped: previously unsubscribed in MailPoet', 'subtleforms' ), 'previously_unsubscribed' );
					}
				}
				$result = $api->subscribeToLists( (string) ( $existing['id'] ?? $sub->email ), array( $listId ), $options );
				$status = 'updated';
			}
		} catch ( ServiceSkip $e ) {
			throw $e;
		} catch ( \Throwable $e ) {
			throw $this->failure( $e ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Caught by Sender and written to the log, never printed.
		}

		$notes = $this->tag( $api, $sub );
		$id    = is_array( $result ) ? (string) ( $result['id'] ?? '' ) : '';
		return array(
			'status' => $status,
			'member' => '' !== $id ? $id : (string) ( $existing['id'] ?? '' ),
			'notes'  => $notes,
		);
	}

	/**
	 * Tags an add-on asked for. Only when this MailPoet can tag; a tag that
	 * fails is noted and does not undo the subscription.
	 *
	 * @param object     $api API.
	 * @param Subscriber $sub Subscriber.
	 * @return string[] Notes about tags that failed.
	 */
	private function tag( object $api, Subscriber $sub ): array {
		$notes = array();
		if ( ! $sub->tags || ! method_exists( $api, 'tagSubscriber' ) ) {
			return $notes;
		}
		foreach ( $sub->tags as $tag ) {
			try {
				$api->tagSubscriber( $sub->email, $tag );
			} catch ( \Throwable $e ) {
				$notes[] = sprintf(
					/* translators: 1: tag, 2: MailPoet's reason */
					__( 'Tag "%1$s" was not added: %2$s', 'subtleforms' ),
					$tag,
					$e->getMessage()
				);
			}
		}
		return $notes;
	}

	/**
	 * MailPoet's record of a person, or null when it has none.
	 *
	 * @param object $api   API.
	 * @param string $email Email address.
	 * @return array<string,mixed>|null
	 * @throws \Throwable MailPoet's refusal, other than "no such subscriber".
	 */
	private function find( object $api, string $email ): ?array {
		try {
			$found = $api->getSubscriber( $email );
		} catch ( \Throwable $e ) {
			if ( $this->is( $e, self::SUBSCRIBER_NOT_EXISTS ) ) {
				return null;
			}
			throw $e;
		}
		return is_array( $found ) && ! empty( $found ) ? $found : null;
	}

	/**
	 * Whether a throwable is MailPoet's exception with a given code.
	 *
	 * @param \Throwable $e    Throwable.
	 * @param int        $code MailPoet's code.
	 */
	private function is( \Throwable $e, int $code ): bool {
		return $e instanceof \Exception && is_a( $e, self::API_EXCEPTION ) && (int) $e->getCode() === $code;
	}

	/**
	 * A plain, not retryable failure carrying MailPoet's own sentence.
	 *
	 * @param \Throwable $e MailPoet's exception, or anything else that went wrong.
	 */
	private function failure( \Throwable $e ): ServiceException {
		$message = trim( wp_strip_all_tags( $e->getMessage() ) );
		if ( '' === $message ) {
			$message = __( 'MailPoet could not add this person', 'subtleforms' );
		}
		return new ServiceException( $message );
	}
}
