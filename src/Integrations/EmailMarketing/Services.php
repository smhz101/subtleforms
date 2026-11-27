<?php
/**
 * The email marketing services this plugin knows, and who is in charge of each.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

use SubtleForms\Integrations\Registry;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Mailchimp, Brevo, Kit and MailPoet are part of this plugin and complete without an
 * add-on. An add-on lists more services, or takes one over, through the
 * `subtleforms/email/marketing/services` filter: an entry with the slug of a
 * service this plugin has, without `builtin => true`, takes that service
 * over. This plugin then sends nothing to it. That is the only rule; it does
 * not depend on which add-on it is.
 *
 * An entry with a new slug and a `client` (a class that implements
 * ClientInterface) is an add-on service this plugin handles like its own:
 * connection, routes, queue, sender and activity log.
 */
final class Services {

	/** Slug of the integration entry in Settings that holds the services. */
	const INTEGRATION = 'email_marketing';

	/**
	 * What this plugin knows about its own services.
	 *
	 * `case` is how a mapped field name is written in the service: Mailchimp
	 * merge tags and Brevo attributes in capitals, Kit custom field keys and
	 * MailPoet field ids as the service has them. `local` marks a service that
	 * is a plugin on this site (MailPoet): it has no API key, so its
	 * connection is worked out from the site, not stored.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	public static function definitions(): array {
		return array(
			'mailchimp' => array(
				'label'       => 'Mailchimp',
				'client'      => MailchimpClient::class,
				'description' => __( 'Add people who fill in a form to a Mailchimp audience.', 'subtleforms' ),
				'case'        => 'upper',
				'tags'        => true,
				'list_required' => true,
			),
			'brevo'     => array(
				'label'       => 'Brevo',
				'client'      => BrevoClient::class,
				'description' => __( 'Add people who fill in a form to a Brevo contact list.', 'subtleforms' ),
				'case'        => 'upper',
				'tags'        => false,
				'list_required' => false,
			),
			'kit'       => array(
				'label'       => 'Kit',
				'client'      => KitClient::class,
				'description' => __( 'Add people who fill in a form to Kit, with tags and a Kit form.', 'subtleforms' ),
				'case'        => 'keep',
				'tags'        => true,
				'list_required' => false,
			),
			'mailpoet'  => array(
				'label'       => 'MailPoet',
				'client'      => MailPoetClient::class,
				'description' => __( 'Add people who fill in a form to a list in the MailPoet plugin on this site.', 'subtleforms' ),
				'case'        => 'keep',
				'tags'        => false,
				'list_required' => true,
				'local'       => true,
			),
		);
	}

	/**
	 * What an add-on lists with a usable client, keyed by slug, with the same
	 * definition keys the built-ins have. An entry with a missing class, a class
	 * that is not a ClientInterface, or the slug of a built-in is left out.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	public static function addons(): array {
		$result = array();
		foreach ( self::all() as $slug => $entry ) {
			if ( ! is_string( $slug ) || '' === $slug || self::isBuiltIn( $slug ) || ! self::validClient( $entry ) ) {
				continue;
			}
			$result[ $slug ] = array(
				'label'         => (string) ( $entry['label'] ?? $slug ),
				'client'        => $entry['client'],
				'description'   => (string) ( $entry['description'] ?? '' ),
				'case'          => 'upper' === ( $entry['case'] ?? 'keep' ) ? 'upper' : 'keep',
				'tags'          => ! empty( $entry['tags'] ),
				'list_required' => ! empty( $entry['list_required'] ),
				'local'         => false,
				'settings'      => self::cleanSettingFields( $entry['settings'] ?? array() ),
			);
		}
		return $result;
	}

	/**
	 * The settings fields an add-on service asks for above the API key:
	 * `name`, `label`, `type` (text or url), `required`, `pattern`, `help`.
	 *
	 * @param mixed $list Fields as listed by the add-on.
	 * @return array<int,array<string,mixed>>
	 */
	public static function cleanSettingFields( $list ): array {
		$out = array();
		foreach ( is_array( $list ) ? $list : array() as $item ) {
			$name = is_array( $item ) ? sanitize_key( (string) ( $item['name'] ?? '' ) ) : '';
			if ( '' === $name ) {
				continue;
			}
			$out[] = array(
				'name'     => $name,
				'label'    => (string) ( $item['label'] ?? $name ),
				'type'     => 'url' === ( $item['type'] ?? '' ) ? 'url' : 'text',
				'required' => ! empty( $item['required'] ),
				'pattern'  => (string) ( $item['pattern'] ?? '' ),
				'help'     => (string) ( $item['help'] ?? '' ),
			);
		}
		return $out;
	}

	/**
	 * Every service this plugin can talk to: its own, then add-on services
	 * with a valid client.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	public static function registered(): array {
		return self::definitions() + self::addons();
	}

	/**
	 * Slugs of every registered service, built-ins first.
	 *
	 * @return string[]
	 */
	public static function slugs(): array {
		return array_keys( self::registered() );
	}

	/**
	 * Whether a slug is a built-in or an add-on service with a valid client.
	 *
	 * @param string $slug Service slug.
	 */
	public static function isRegistered( string $slug ): bool {
		return isset( self::registered()[ $slug ] );
	}

	/**
	 * Whether a listed entry names a class that implements ClientInterface.
	 *
	 * @param mixed $entry Entry from the services filter.
	 */
	private static function validClient( $entry ): bool {
		$class = is_array( $entry ) ? ( $entry['client'] ?? null ) : null;
		return is_string( $class ) && class_exists( $class ) && is_subclass_of( $class, ClientInterface::class, true );
	}

	/**
	 * Whether a slug is one of this plugin's own services.
	 *
	 * @param string $slug Service slug.
	 */
	public static function isBuiltIn( string $slug ): bool {
		return isset( self::definitions()[ $slug ] );
	}

	/**
	 * Whether a service is a plugin on this site, with no key and no stored
	 * connection (MailPoet).
	 *
	 * @param string $slug Service slug.
	 */
	public static function isLocal( string $slug ): bool {
		return ! empty( self::definitions()[ $slug ]['local'] );
	}

	/**
	 * Connection status of a service: `connected`, `error` or `none`. For a
	 * service on this site it is derived: connected while MailPoet is active
	 * and set up.
	 *
	 * @param string $slug Service slug.
	 */
	public static function status( string $slug ): string {
		if ( self::isLocal( $slug ) ) {
			return MailPoetStatus::ready() ? Connection::STATUS_CONNECTED : Connection::STATUS_NONE;
		}
		return ( new Connection( $slug ) )->status();
	}

	/**
	 * Whether a service can take people right now: a key is saved, or, for a
	 * service on this site, it is ready.
	 *
	 * @param string $slug Service slug.
	 */
	public static function usable( string $slug ): bool {
		if ( self::isLocal( $slug ) ) {
			return MailPoetStatus::ready();
		}
		return ( new Connection( $slug ) )->hasKey();
	}

	/**
	 * What the browser may know about one service's connection. Never a key.
	 * A service on this site adds `local` (its state and the addresses of its
	 * next step) and a derived status.
	 *
	 * @param string $slug Service slug.
	 * @return array<string,mixed>
	 */
	public static function state( string $slug ): array {
		$state = ( new Connection( $slug ) )->state();
		if ( self::isLocal( $slug ) ) {
			$ready              = MailPoetStatus::ready();
			$state['status']    = $ready ? Connection::STATUS_CONNECTED : Connection::STATUS_NONE;
			$state['has_key']   = false;
			$state['connected'] = $ready;
			$state['local']     = MailPoetStatus::describe();
		}
		return $state;
	}

	/**
	 * The client of a service.
	 *
	 * @param string $slug    Service slug.
	 * @param string $key     API key.
	 * @param int    $timeout Seconds.
	 * @param array  $settings The service's own settings.
	 * @throws ServiceException For a slug this plugin has no client for.
	 */
	public static function client( string $slug, string $key, int $timeout = AbstractClient::ADMIN_TIMEOUT, array $settings = array() ): ClientInterface {
		$def = self::registered()[ $slug ] ?? null;
		if ( null === $def ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new ServiceException( __( 'Unknown email marketing service.', 'subtleforms' ) );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		$class = $def['client'];
		return new $class( $key, $timeout, $settings );
	}

	/**
	 * A built-in service's client built from its saved connection.
	 *
	 * @param string $slug    Service slug.
	 * @param int    $timeout Seconds.
	 */
	public static function clientFor( string $slug, int $timeout = AbstractClient::JOB_TIMEOUT ): ClientInterface {
		$connection = new Connection( $slug );
		return self::client( $slug, $connection->apiKey(), $timeout, $connection->settings() );
	}

	/**
	 * The services to list, keyed by slug: this plugin's own, then what an
	 * add-on lists.
	 *
	 * @return array<string,array>
	 */
	public static function all(): array {
		$result = array();
		foreach ( self::definitions() as $slug => $def ) {
			$connection = new Connection( $slug );
			$status     = self::status( $slug );
			$result[ $slug ] = array(
				'slug'        => $slug,
				'label'       => $def['label'],
				'description' => $def['description'],
				'available'   => true,
				'enabled'     => $connection->isEnabled(),
				'configured'  => Connection::STATUS_CONNECTED === $status,
				'builtin'     => true,
				'tags'        => (bool) $def['tags'],
			);
			if ( ! empty( $def['local'] ) ) {
				// Only what the tile needs: the state, not the addresses.
				$result[ $slug ]['local']       = true;
				$result[ $slug ]['local_state'] = MailPoetStatus::state();
			}
		}

		/**
		 * Email marketing services an add-on lists in Settings > Integrations
		 * > Email marketing.
		 *
		 * An entry with the slug of one of this plugin's services that does
		 * not carry `builtin => true` replaces it: this plugin then sends
		 * nothing to that service. A new slug adds a tile; the add-on draws
		 * its screens in the browser with `registerEmailMarketingService`.
		 * A new slug with `client` (a class that implements ClientInterface),
		 * `case`, `tags`, `list_required` and `label` is sent to by this
		 * plugin like a built-in service.
		 *
		 * @param array<string, array> $services Map of slug to { slug, label, description, available, enabled, configured, builtin }.
		 * @since 2.8.0
		 */
		$result = apply_filters( 'subtleforms/email/marketing/services', $result );
		$result = is_array( $result ) ? $result : array();
		foreach ( $result as $slug => $entry ) {
			if ( is_string( $slug ) && ! self::isBuiltIn( $slug ) && self::validClient( $entry ) ) {
				// An add-on service with a client is stored and switched like a built-in one.
				$connection     = new Connection( $slug );
				$result[ $slug ] = $entry + array(
					'slug'       => $slug,
					'available'  => true,
					'enabled'    => $connection->isEnabled(),
					'configured' => Connection::STATUS_CONNECTED === $connection->status(),
					'builtin'    => false,
					'core'       => true,
				);
				$result[ $slug ]['settings'] = self::cleanSettingFields( $entry['settings'] ?? array() );
			}
		}
		return $result;
	}

	/**
	 * Whether this plugin is the one in charge of a service: the Email
	 * marketing integration is its own and no add-on took the service over.
	 *
	 * @param string $slug Service slug.
	 */
	public static function coreOwns( string $slug ): bool {
		if ( ! Registry::coreOwnsEmailMarketing() ) {
			return false;
		}
		if ( ! self::isBuiltIn( $slug ) ) {
			try {
				return isset( self::addons()[ $slug ] );
			} catch ( \Throwable $e ) {
				return false;
			}
		}
		try {
			$all = self::all();
		} catch ( \Throwable $e ) {
			return true;
		}
		$entry = $all[ $slug ] ?? null;
		return is_array( $entry ) && ! empty( $entry['builtin'] );
	}

	/**
	 * The extras an add-on gives each service (slugs of the services it adds
	 * options to). Empty while no add-on adds any.
	 *
	 * @return string[]
	 */
	public static function extras(): array {
		/**
		 * Which email marketing services an add-on adds extra options to
		 * (several lists per form, conditional sending, tags from answers and
		 * so on). Return the slugs. This plugin shows its note about the add-on
		 * only while the list is empty.
		 *
		 * @param string[] $slugs Service slugs. Default none.
		 * @since 2.8.0
		 */
		$slugs = apply_filters( 'subtleforms/email/marketing/extras', array() );
		return is_array( $slugs ) ? array_values( array_unique( array_map( 'strval', $slugs ) ) ) : array();
	}
}
