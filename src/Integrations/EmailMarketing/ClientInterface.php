<?php
/**
 * What the screens and the sender need from an email marketing service.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

interface ClientInterface {

	/**
	 * Whether a string has the shape of this service's API key.
	 *
	 * @param string $key Key.
	 */
	public static function looksLikeKey( string $key ): bool;

	/**
	 * Check the key and read the account behind it.
	 *
	 * @return array{name:string,email:string}
	 * @throws ServiceException When the key is refused or the service cannot be reached.
	 */
	public function account(): array;

	/**
	 * The lists, audiences or forms a person can be added to.
	 *
	 * @return array<int,array{id:string,name:string,count:?int}>
	 * @throws ServiceException On an error answer.
	 */
	public function lists(): array;

	/**
	 * The fields an answer can be sent to, without email and name (those have
	 * their own rows in the mapping).
	 *
	 * @param string $listId List, audience or form ID (some services ignore it).
	 * @return array<int,array{tag:string,name:string,type:string,required:bool}>
	 * @throws ServiceException On an error answer.
	 */
	public function fields( string $listId ): array;

	/**
	 * Whether the person is already known to the service (in the list, for
	 * services whose contacts belong to a list).
	 *
	 * @param string $listId List, audience or form ID.
	 * @param string $email  Email address.
	 * @throws ServiceException On an error answer other than "not found".
	 */
	public function isMember( string $listId, string $email ): bool;

	/**
	 * Add or update one person. Every request of the delivery goes through
	 * here, so a retry repeats the same steps (all of them are safe to repeat).
	 *
	 * @param Subscriber    $sub        Subscriber.
	 * @param callable|null $bodyFilter Receives the body of the main request and returns it.
	 * @return array{status:string,member:string,notes:string[]} `status` is subscribed, pending, updated or another member status.
	 * @throws ServiceException On a failed request.
	 */
	public function subscribe( Subscriber $sub, ?callable $bodyFilter = null ): array;
}
