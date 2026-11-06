<?php
/**
 * The integrations Settings lists.
 *
 * @package SubtleForms\Integrations
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations;

use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\EmailMarketing\Services;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Webhooks and Email marketing are part of this plugin. An add-on lists its
 * own integrations through `subtleforms/admin/integrations`.
 *
 * An add-on that lists an entry under the slug `email_marketing` without the
 * `builtin` flag takes the whole integration over: this plugin sends nothing
 * to Mailchimp, Brevo or Kit and its Email marketing screens leave the screen
 * to the add-on (this is how SubtleForms Pro 2.8.0 keeps working beside this
 * plugin). To take over a single service, use
 * `subtleforms/email/marketing/services` instead.
 */
final class Registry {

	/**
	 * The integrations to list, keyed by slug.
	 *
	 * @return array<string,array>
	 */
	public static function all(): array {
		$result = array(
			'webhooks'                => array(
				'slug'        => 'webhooks',
				'label'       => __( 'Webhooks', 'subtleforms' ),
				'description' => __( 'Send each entry as JSON to any URL, with retries and signed requests.', 'subtleforms' ),
				'available'   => true,
				'enabled'     => true,
				'configured'  => true,
			),
			Services::INTEGRATION     => self::emailMarketing(),
		);

		/**
		 * Integrations an add-on lists in Settings.
		 *
		 * Listing an entry with the slug `email_marketing` that does not
		 * carry `builtin => true` replaces this plugin's Email marketing: it
		 * then sends nothing and shows no Email marketing screens of its own.
		 *
		 * @param array<string, array> $integrations Map of slug to integration data.
		 * @since 2.8.0
		 */
		$result = apply_filters( 'subtleforms/admin/integrations', $result );

		return is_array( $result ) ? $result : array();
	}

	/**
	 * This plugin's Email marketing entry. It is on while any of its services
	 * is switched on, and set up while a switched-on service is connected.
	 *
	 * @return array<string,mixed>
	 */
	private static function emailMarketing(): array {
		$enabled    = false;
		$configured = false;
		foreach ( Services::slugs() as $slug ) {
			$connection = new Connection( $slug );
			if ( $connection->isEnabled() ) {
				$enabled = true;
				if ( Connection::STATUS_CONNECTED === Services::status( $slug ) ) {
					$configured = true;
				}
			}
		}
		return array(
			'slug'        => Services::INTEGRATION,
			'label'       => __( 'Email marketing', 'subtleforms' ),
			'description' => __( 'Add people who fill in a form to Mailchimp, Brevo, Kit or MailPoet.', 'subtleforms' ),
			'available'   => true,
			'enabled'     => $enabled,
			'configured'  => $configured,
			'builtin'     => true,
		);
	}

	/**
	 * Whether this plugin's own Email marketing is the one in charge: nothing
	 * replaced the entry.
	 */
	public static function coreOwnsEmailMarketing(): bool {
		try {
			$all = self::all();
		} catch ( \Throwable $e ) {
			return true;
		}
		$entry = $all[ Services::INTEGRATION ] ?? null;
		return is_array( $entry ) && ! empty( $entry['builtin'] );
	}
}
