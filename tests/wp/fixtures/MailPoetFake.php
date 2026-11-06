<?php
// phpcs:disable -- Test fixture; not shipped in production plugin.
/**
 * A stand-in for MailPoet's PHP API, defined only when the real plugin is not
 * loaded. It keeps the shape of `\MailPoet\API\MP\v1\API` (method names,
 * arguments, the exception and its codes) so the client is tested against the
 * same calls it makes in production.
 */

namespace MailPoet\API\MP\v1 {
	if ( ! class_exists( '\MailPoet\API\MP\v1\APIException', false ) ) {
		class APIException extends \Exception {
			const SUBSCRIBER_NOT_EXISTS = 4;
			const LIST_NOT_EXISTS       = 5;
			const SUBSCRIBER_EXISTS     = 12;
		}
	}
}

namespace MailPoet\API {
	if ( ! class_exists( '\MailPoet\API\API', false ) ) {
		class API {
			/** @var object|null Set by the test. */
			public static $v1 = null;

			public static function MP( $version = 'v1' ) {
				return self::$v1;
			}
		}
	}
}

namespace SubtleForms\Tests\WP {
	/**
	 * The fake v1 API object.
	 */
	class MailPoetV1Fake {

		/** @var bool True when this file defined the MailPoet classes, so the fake is what runs. */
		public static function active(): bool {
			return ( new \ReflectionClass( '\MailPoet\API\API' ) )->getFileName() === __FILE__;
		}

		/** @var array[] */
		public $lists = array();

		/** @var array[] */
		public $fields = array();

		/** @var array<string,array> Subscribers by email. */
		public $subscribers = array();

		/** @var array[] What was called, in order: { method, args }. */
		public $calls = array();

		/** @var bool */
		public $setupComplete = true;

		/** @var \Throwable|null Thrown by addSubscriber and subscribeToLists. */
		public $failWith = null;

		/** @var int */
		public $unconfirmedForNew = 0;

		public function __construct() {
			$this->lists  = array(
				array( 'id' => '1', 'name' => 'Newsletter', 'type' => 'default' ),
				array( 'id' => '2', 'name' => 'Customers', 'type' => 'default' ),
			);
			$this->fields = array(
				array( 'id' => 'email', 'name' => 'Email', 'type' => 'text', 'params' => array( 'required' => '1' ) ),
				array( 'id' => 'first_name', 'name' => 'First name', 'type' => 'text', 'params' => array( 'required' => '' ) ),
				array( 'id' => 'last_name', 'name' => 'Last name', 'type' => 'text', 'params' => array( 'required' => '' ) ),
				array( 'id' => 'cf_1', 'name' => 'Company', 'type' => 'text', 'params' => array( 'required' => '' ) ),
				array( 'id' => 'cf_2', 'name' => 'Plan', 'type' => 'select', 'params' => array( 'required' => '1' ) ),
			);
		}

		private function log( string $method, array $args ): void {
			$this->calls[] = array( 'method' => $method, 'args' => $args );
		}

		public function called( string $method ): array {
			return array_values( array_filter( $this->calls, static fn( $c ) => $method === $c['method'] ) );
		}

		public function getLists() {
			$this->log( 'getLists', array() );
			return $this->lists;
		}

		public function getSubscriberFields() {
			$this->log( 'getSubscriberFields', array() );
			return $this->fields;
		}

		public function isSetupComplete() {
			return $this->setupComplete;
		}

		public function getSubscriber( $email ) {
			$this->log( 'getSubscriber', array( $email ) );
			if ( ! isset( $this->subscribers[ $email ] ) ) {
				throw new \MailPoet\API\MP\v1\APIException( 'This subscriber does not exist.', 4 );
			}
			return $this->subscribers[ $email ];
		}

		public function addSubscriber( array $subscriber, $listIds = array(), $options = array() ) {
			$this->log( 'addSubscriber', array( $subscriber, $listIds, $options ) );
			if ( $this->failWith ) {
				throw $this->failWith;
			}
			$known = array( 1, 2 );
			foreach ( $listIds as $id ) {
				if ( ! in_array( (int) $id, $known, true ) ) {
					throw new \MailPoet\API\MP\v1\APIException( "List with ID '" . $id . "' does not exist.", 5 );
				}
			}
			$row = array(
				'id'            => (string) ( 100 + count( $this->subscribers ) ),
				'email'         => $subscriber['email'],
				'first_name'    => $subscriber['first_name'] ?? '',
				'last_name'     => $subscriber['last_name'] ?? '',
				'status'        => $this->unconfirmedForNew ? 'unconfirmed' : 'subscribed',
				'subscriptions' => array_map( static fn( $l ) => array( 'segment_id' => (string) $l, 'status' => 'subscribed' ), $listIds ),
			);
			$this->subscribers[ $subscriber['email'] ] = $row;
			return $row;
		}

		public function subscribeToLists( $subscriberId, array $listIds, $options = array() ) {
			$this->log( 'subscribeToLists', array( $subscriberId, $listIds, $options ) );
			if ( $this->failWith ) {
				throw $this->failWith;
			}
			foreach ( $this->subscribers as $email => $row ) {
				if ( (string) $row['id'] === (string) $subscriberId || $email === $subscriberId ) {
					foreach ( $listIds as $l ) {
						$this->subscribers[ $email ]['subscriptions'][] = array( 'segment_id' => (string) $l, 'status' => 'subscribed' );
					}
					return $this->subscribers[ $email ];
				}
			}
			throw new \MailPoet\API\MP\v1\APIException( 'This subscriber does not exist.', 4 );
		}

		public function tagSubscriber( $subscriberIdOrEmail, $tagIdOrName ) {
			$this->log( 'tagSubscriber', array( $subscriberIdOrEmail, $tagIdOrName ) );
			return array();
		}
	}
}
