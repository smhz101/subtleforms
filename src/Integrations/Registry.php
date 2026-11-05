<?php
/**
 * The integrations Settings lists.
 *
 * @package SubtleForms\Integrations
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations;

use SubtleForms\Integrations\Mailchimp\Connection;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Webhooks and Mailchimp are part of this plugin. An add-on lists its own
 * integrations through `subtleforms/admin/integrations`.
 *
 * An add-on that lists an entry under the slug `mailchimp` without the
 * `builtin` flag takes Mailchimp over: this plugin sends nothing to
 * Mailchimp and both Mailchimp panels in the admin leave the screen to the
 * add-on. That is the only rule; it does not depend on which add-on it is.
 */
final class Registry {

	/** Slug of the Mailchimp integration. */
	const MAILCHIMP = 'mailchimp';

	/**
	 * The integrations to list, keyed by slug.
	 *
	 * @return array<string,array>
	 */
	public static function all(): array {
		$result = array(
			'webhooks'        => array(
				'slug'        => 'webhooks',
				'label'       => __( 'Webhooks', 'subtleforms' ),
				'description' => __( 'Send each entry as JSON to any URL, with retries and signed requests.', 'subtleforms' ),
				'available'   => true,
				'enabled'     => true,
				'configured'  => true,
			),
			self::MAILCHIMP   => self::mailchimp(),
		);

		/**
		 * Integrations an add-on lists in Settings.
		 *
		 * Listing an entry with the slug `mailchimp` that does not carry
		 * `builtin => true` replaces this plugin's Mailchimp: it then sends
		 * nothing and shows no Mailchimp panels of its own.
		 *
		 * @param array<string, array> $integrations Map of slug to integration data.
		 * @since 2.8.0
		 */
		$result = apply_filters( 'subtleforms/admin/integrations', $result );

		return is_array( $result ) ? $result : array();
	}

	/**
	 * This plugin's Mailchimp entry.
	 *
	 * @return array<string,mixed>
	 */
	private static function mailchimp(): array {
		$status = Connection::status();
		return array(
			'slug'        => self::MAILCHIMP,
			'label'       => __( 'Mailchimp', 'subtleforms' ),
			'description' => __( 'Add people who fill in a form to a Mailchimp audience.', 'subtleforms' ),
			'available'   => true,
			'enabled'     => Connection::STATUS_NONE !== $status,
			'configured'  => Connection::STATUS_CONNECTED === $status,
			'builtin'     => true,
		);
	}

	/**
	 * Whether this plugin's own Mailchimp is the one in charge: nothing
	 * replaced the entry.
	 */
	public static function coreOwnsMailchimp(): bool {
		try {
			$all = self::all();
		} catch ( \Throwable $e ) {
			return true;
		}
		$entry = $all[ self::MAILCHIMP ] ?? null;
		return is_array( $entry ) && ! empty( $entry['builtin'] );
	}
}
