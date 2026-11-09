<?php
/**
 * The CRM services this plugin knows, and who is in charge of each.
 *
 * @package SubtleForms\Integrations\Crm
 * @since   2.8.1
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Crm;

use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\Registry;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * HubSpot (contacts) is part of this plugin and completes without an add-on.
 * An add-on lists more CRMs, or takes one over, through the
 * `subtleforms/crm/services` filter: an entry with the slug of a service this
 * plugin has, without `builtin => true`, takes that service over and this
 * plugin then sends nothing to it. That is the only rule; it does not depend
 * on which add-on it is.
 *
 * The connection of a service is stored the way email marketing stores its
 * own, by `Connection`, under the service slug.
 */
final class Services {

	/** Slug of the integration entry in Settings that holds the CRMs. */
	const INTEGRATION = 'crm';

	/**
	 * What this plugin knows about its own services.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	public static function definitions(): array {
		return array(
			'hubspot' => array(
				'label'       => 'HubSpot',
				'client'      => HubSpotClient::class,
				'description' => __( 'Create or update a HubSpot contact for each entry.', 'subtleforms' ),
			),
		);
	}

	/**
	 * Slugs of this plugin's own services, in grid order.
	 *
	 * @return string[]
	 */
	public static function slugs(): array {
		return array_keys( self::definitions() );
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
	 * Connection status of a service: `connected`, `error` or `none`.
	 *
	 * @param string $slug Service slug.
	 */
	public static function status( string $slug ): string {
		return ( new Connection( $slug ) )->status();
	}

	/**
	 * Whether a service can take contacts right now: a token is saved.
	 *
	 * @param string $slug Service slug.
	 */
	public static function usable( string $slug ): bool {
		return ( new Connection( $slug ) )->hasKey();
	}

	/**
	 * What the browser may know about one service's connection. Never the token.
	 *
	 * @param string $slug Service slug.
	 * @return array<string,mixed>
	 */
	public static function state( string $slug ): array {
		$state = ( new Connection( $slug ) )->state();
		unset( $state['account_email'] );
		return $state;
	}

	/**
	 * A built-in service's client built from its saved connection.
	 *
	 * @param string $slug    Service slug.
	 * @param int    $timeout Seconds.
	 * @throws \SubtleForms\Integrations\EmailMarketing\ServiceException For a slug this plugin has no client for.
	 */
	public static function clientFor( string $slug, int $timeout = HubSpotClient::JOB_TIMEOUT ): HubSpotClient {
		if ( ! self::isBuiltIn( $slug ) ) {
			// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are shown as JSON or in the entry log, never printed as HTML.
			throw new \SubtleForms\Integrations\EmailMarketing\ServiceException( __( 'Unknown CRM.', 'subtleforms' ) );
			// phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		return new HubSpotClient( ( new Connection( $slug ) )->apiKey(), $timeout );
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
			$connection      = new Connection( $slug );
			$result[ $slug ] = array(
				'slug'        => $slug,
				'label'       => $def['label'],
				'description' => $def['description'],
				'available'   => true,
				'enabled'     => $connection->isEnabled(),
				'configured'  => Connection::STATUS_CONNECTED === self::status( $slug ),
				'builtin'     => true,
			);
		}

		/**
		 * CRMs an add-on lists in Settings > Integrations > CRM.
		 *
		 * An entry with the slug of one of this plugin's services that does
		 * not carry `builtin => true` replaces it: this plugin then sends
		 * nothing to that service. A new slug adds a tile; the add-on draws
		 * its screens in the browser with `registerCrmService`.
		 *
		 * @param array<string, array> $services Map of slug to { slug, label, description, available, enabled, configured, builtin }.
		 * @since 2.8.1
		 */
		$result = apply_filters( 'subtleforms/crm/services', $result );
		return is_array( $result ) ? $result : array();
	}

	/**
	 * Whether this plugin is the one in charge of a service: the CRM
	 * integration is its own and no add-on took the service over.
	 *
	 * @param string $slug Service slug.
	 */
	public static function coreOwns( string $slug ): bool {
		if ( ! self::isBuiltIn( $slug ) || ! Registry::coreOwnsCrm() ) {
			return false;
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
	 * The extras an add-on gives each CRM (slugs of the services it adds
	 * options to). Empty while no add-on adds any.
	 *
	 * @return string[]
	 */
	public static function extras(): array {
		/**
		 * Which CRMs an add-on adds extra options to (deals, companies,
		 * lifecycle stage, owner, notes, conditional sending and so on).
		 * Return the slugs. This plugin shows its note about the add-on only
		 * while the list is empty.
		 *
		 * @param string[] $slugs Service slugs. Default none.
		 * @since 2.8.1
		 */
		$slugs = apply_filters( 'subtleforms/crm/extras', array() );
		return is_array( $slugs ) ? array_values( array_unique( array_map( 'strval', $slugs ) ) ) : array();
	}
}
