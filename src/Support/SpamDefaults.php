<?php
/**
 * Spam protection defaults for new installs, and the one-time offer to
 * existing sites (2.6.0).
 *
 * New installs: the hidden trap field and the time trap are on in the site
 * settings, so every new form starts with both on.
 *
 * Existing sites: nothing changes on update. When some forms have either
 * one off, the dashboard shows a one-time notice that turns both on for
 * every form in one step. That step remembers what it changed, so Undo puts
 * back exactly the settings each form had.
 *
 * @package SubtleForms\Support
 * @since   2.6.0
 */

namespace SubtleForms\Support;

use SubtleForms\Engine\SpamProtection;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Defaults, notice state and the bulk switch.
 */
final class SpamDefaults {

	/**
	 * Notice state: none (new install, never shown), pending (existing site,
	 * not answered yet), enabled (turned on, Undo offered), dismissed.
	 * Autoloaded, since it is read on every request.
	 */
	const NOTICE_OPTION = 'subtleforms_spam_notice';

	/** What the bulk switch changed, for Undo. */
	const UNDO_OPTION = 'subtleforms_spam_undo';

	/** Stored when a key was not set before the bulk switch. */
	const ABSENT = '__absent__';

	/** Minimum time the bulk switch sets when the site had the time trap off. */
	const DEFAULT_MIN_SECONDS = 3;

	/**
	 * Register hooks. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'markExistingSite' ), 6 );
	}

	/**
	 * Whether this is a new install: SubtleForms never ran on this site.
	 * Must be read before the activation steps store the database version.
	 */
	public static function isFreshInstall(): bool {
		return false === get_option( 'subtleforms_db_version' ) && false === get_option( Settings::OPTION_NAME );
	}

	/**
	 * After the activation steps. A new install stores the protective
	 * defaults; an existing site is offered the notice.
	 *
	 * @param bool $fresh From isFreshInstall(), read before activation.
	 */
	public static function afterActivate( bool $fresh ): void {
		if ( $fresh ) {
			$settings = get_option( Settings::OPTION_NAME, array() );
			$settings = is_array( $settings ) ? $settings : array();
			$settings['enable_honeypot']     = true;
			$settings['min_submission_time'] = isset( $settings['min_submission_time'] ) && (int) $settings['min_submission_time'] > 0
				? (int) $settings['min_submission_time']
				: self::DEFAULT_MIN_SECONDS;
			update_option( Settings::OPTION_NAME, $settings );
			update_option( self::NOTICE_OPTION, 'none', true );
			return;
		}
		if ( false === get_option( self::NOTICE_OPTION ) ) {
			update_option( self::NOTICE_OPTION, 'pending', true );
		}
	}

	/**
	 * A site that already ran SubtleForms and has no notice state yet (an
	 * update that did not run the activation steps) is an existing site.
	 */
	public static function markExistingSite(): void {
		if ( false === get_option( self::NOTICE_OPTION ) && false !== get_option( 'subtleforms_db_version' ) ) {
			update_option( self::NOTICE_OPTION, 'pending', true );
		}
	}

	/**
	 * What the dashboard shows.
	 *
	 * @return array{notice: string|null, forms_off: int, changed: int}
	 */
	public static function status(): array {
		$state = (string) get_option( self::NOTICE_OPTION, 'none' );

		if ( 'enabled' === $state ) {
			$undo = get_option( self::UNDO_OPTION );
			if ( is_array( $undo ) ) {
				return array(
					'notice'    => 'enabled',
					'forms_off' => count( self::formsWithProtectionOff() ),
					'changed'   => (int) ( $undo['changed'] ?? 0 ),
				);
			}
			return array( 'notice' => null, 'forms_off' => 0, 'changed' => 0 );
		}

		if ( 'pending' !== $state ) {
			return array( 'notice' => null, 'forms_off' => 0, 'changed' => 0 );
		}

		$off = count( self::formsWithProtectionOff() );
		return array(
			// Nothing to offer when every form is already protected.
			'notice'    => $off > 0 ? 'invite' : null,
			'forms_off' => $off,
			'changed'   => 0,
		);
	}

	/**
	 * IDs of forms (not in the Trash) where the hidden trap field or the
	 * time trap is off, read from what visitors get: the published schema,
	 * or the draft for a form never published.
	 *
	 * @return int[]
	 */
	public static function formsWithProtectionOff(): array {
		$off = array();
		foreach ( self::rows() as $row ) {
			if ( 'trash' === ( $row['status'] ?? '' ) ) {
				continue;
			}
			$schema = $row['active'] ?? $row['draft'] ?? $row['config'] ?? null;
			$p      = SpamProtection::for_form( is_array( $schema ) ? $schema : null );
			if ( ! $p['honeypot'] || ! $p['timeTrap'] ) {
				$off[] = (int) $row['id'];
			}
		}
		return $off;
	}

	/**
	 * Turn the hidden trap field and the time trap on for every form and as
	 * the site default. Nothing else is changed.
	 *
	 * @return int Number of forms changed.
	 */
	public static function enableAll(): int {
		global $wpdb;
		$formsTable   = $wpdb->prefix . 'subtleforms_forms';
		$schemasTable = $wpdb->prefix . 'subtleforms_form_schemas';
		$on           = array(
			'honeypot' => true,
			'timeTrap' => true,
		);

		$undo = array(
			'forms'    => array(),
			'schemas'  => array(),
			'settings' => array(),
			'changed'  => 0,
		);

		$changedForms = array();
		foreach ( self::rows() as $row ) {
			$formId = (int) $row['id'];
			$update = array();
			foreach ( array( 'config', 'draft_schema' ) as $column ) {
				$key    = 'config' === $column ? 'config' : 'draft';
				$schema = $row[ $key ] ?? null;
				if ( ! is_array( $schema ) || ( 'config' === $column && ! isset( $schema['fields'] ) ) ) {
					continue;
				}
				$before = self::spamOf( $schema );
				if ( $before === $on ) {
					continue;
				}
				$undo['forms'][ $formId ][ $column ] = $before ?? self::ABSENT;
				$schema['metadata']                  = is_array( $schema['metadata'] ?? null ) ? $schema['metadata'] : array();
				$schema['metadata'][ SpamProtection::FORM_KEY ] = $on;
				$update[ $column ]                   = wp_json_encode( $schema );
			}
			if ( $update ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One admin action; caches are cleared below.
				$wpdb->update( $formsTable, $update, array( 'id' => $formId ) );
				$changedForms[ $formId ] = true;
			}

			if ( isset( $row['active_row'] ) && is_array( $row['active'] ?? null ) ) {
				$before = self::spamOf( $row['active'] );
				if ( $before !== $on ) {
					$schema                                         = $row['active'];
					$schema['metadata']                             = is_array( $schema['metadata'] ?? null ) ? $schema['metadata'] : array();
					$schema['metadata'][ SpamProtection::FORM_KEY ] = $on;
					$undo['schemas'][ (int) $row['active_row'] ]    = array(
						'form_id' => $formId,
						'before'  => $before ?? self::ABSENT,
					);
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One admin action; caches are cleared below.
					$wpdb->update( $schemasTable, array( 'schema_data' => wp_json_encode( $schema ) ), array( 'id' => (int) $row['active_row'] ) );
					$changedForms[ $formId ] = true;
				}
			}
			self::clearCache( $formId );
		}

		// The site default, so forms created later start protected too.
		$settings = get_option( Settings::OPTION_NAME, array() );
		$settings = is_array( $settings ) ? $settings : array();
		foreach ( array( 'enable_honeypot', 'min_submission_time' ) as $key ) {
			$undo['settings'][ $key ] = array_key_exists( $key, $settings ) ? $settings[ $key ] : self::ABSENT;
		}
		$settings['enable_honeypot'] = true;
		if ( ! isset( $settings['min_submission_time'] ) || (int) $settings['min_submission_time'] <= 0 ) {
			$settings['min_submission_time'] = self::DEFAULT_MIN_SECONDS;
		}
		update_option( Settings::OPTION_NAME, $settings );

		$undo['changed'] = count( $changedForms );
		update_option( self::UNDO_OPTION, $undo, false );
		update_option( self::NOTICE_OPTION, 'enabled', true );

		return $undo['changed'];
	}

	/**
	 * Put back what enableAll() changed. A form whose spam settings were
	 * changed again since then keeps its newer settings.
	 *
	 * @return int Number of forms put back.
	 */
	public static function undo(): int {
		$undo = get_option( self::UNDO_OPTION );
		if ( ! is_array( $undo ) ) {
			return 0;
		}

		global $wpdb;
		$formsTable   = $wpdb->prefix . 'subtleforms_forms';
		$schemasTable = $wpdb->prefix . 'subtleforms_form_schemas';
		$on           = array(
			'honeypot' => true,
			'timeTrap' => true,
		);
		$restored     = array();

		$rows = array();
		foreach ( self::rows() as $row ) {
			$rows[ (int) $row['id'] ] = $row;
		}

		foreach ( (array) ( $undo['forms'] ?? array() ) as $formId => $columns ) {
			$row = $rows[ (int) $formId ] ?? null;
			if ( ! $row ) {
				continue;
			}
			$update = array();
			foreach ( (array) $columns as $column => $before ) {
				$schema = $row[ 'config' === $column ? 'config' : 'draft' ] ?? null;
				if ( ! is_array( $schema ) || self::spamOf( $schema ) !== $on ) {
					continue;
				}
				$update[ $column ] = wp_json_encode( self::withSpam( $schema, $before ) );
			}
			if ( $update ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One admin action; caches are cleared below.
				$wpdb->update( $formsTable, $update, array( 'id' => (int) $formId ) );
				$restored[ (int) $formId ] = true;
			}
			self::clearCache( (int) $formId );
		}

		foreach ( (array) ( $undo['schemas'] ?? array() ) as $rowId => $entry ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed table name; prepared value.
			$json   = $wpdb->get_var( $wpdb->prepare( "SELECT schema_data FROM {$schemasTable} WHERE id = %d", (int) $rowId ) );
			$schema = is_string( $json ) ? json_decode( $json, true ) : null;
			if ( ! is_array( $schema ) || self::spamOf( $schema ) !== $on ) {
				continue;
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One admin action; caches are cleared below.
			$wpdb->update( $schemasTable, array( 'schema_data' => wp_json_encode( self::withSpam( $schema, $entry['before'] ?? self::ABSENT ) ) ), array( 'id' => (int) $rowId ) );
			$formId              = (int) ( $entry['form_id'] ?? 0 );
			$restored[ $formId ] = true;
			self::clearCache( $formId );
		}

		$settings = get_option( Settings::OPTION_NAME, array() );
		$settings = is_array( $settings ) ? $settings : array();
		foreach ( (array) ( $undo['settings'] ?? array() ) as $key => $before ) {
			if ( self::ABSENT === $before ) {
				unset( $settings[ $key ] );
			} else {
				$settings[ $key ] = $before;
			}
		}
		update_option( Settings::OPTION_NAME, $settings );

		delete_option( self::UNDO_OPTION );
		update_option( self::NOTICE_OPTION, 'dismissed', true );

		return count( $restored );
	}

	/**
	 * Hide the notice for good.
	 */
	public static function dismiss(): void {
		delete_option( self::UNDO_OPTION );
		update_option( self::NOTICE_OPTION, 'dismissed', true );
	}

	/**
	 * Every form with its stored schemas, decoded.
	 *
	 * @return array<int, array{id:int, status:string, config:?array, draft:?array, active:?array, active_row:?int}>
	 */
	private static function rows(): array {
		global $wpdb;
		$formsTable   = $wpdb->prefix . 'subtleforms_forms';
		$schemasTable = $wpdb->prefix . 'subtleforms_form_schemas';

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed table names; admin-only reads.
		$forms  = $wpdb->get_results( "SELECT id, status, config, draft_schema FROM {$formsTable}", ARRAY_A );
		$active = $wpdb->get_results( "SELECT id, form_id, schema_data FROM {$schemasTable} WHERE active = 1", ARRAY_A );
		// phpcs:enable

		$activeByForm = array();
		foreach ( (array) $active as $row ) {
			$activeByForm[ (int) $row['form_id'] ] = $row;
		}

		$out = array();
		foreach ( (array) $forms as $form ) {
			$id    = (int) $form['id'];
			$act   = $activeByForm[ $id ] ?? null;
			$out[] = array(
				'id'         => $id,
				'status'     => (string) ( $form['status'] ?? '' ),
				'config'     => self::decode( $form['config'] ?? null ),
				'draft'      => self::decode( $form['draft_schema'] ?? null ),
				'active'     => $act ? self::decode( $act['schema_data'] ?? null ) : null,
				'active_row' => $act ? (int) $act['id'] : null,
			);
		}
		return $out;
	}

	/**
	 * Decode a stored schema, or null.
	 *
	 * @param mixed $json Stored JSON.
	 */
	private static function decode( $json ): ?array {
		if ( ! is_string( $json ) || '' === $json ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * A schema's own spam settings, or null.
	 *
	 * @param array $schema Schema.
	 */
	private static function spamOf( array $schema ): ?array {
		$spam = $schema['metadata'][ SpamProtection::FORM_KEY ] ?? null;
		if ( ! is_array( $spam ) ) {
			return null;
		}
		ksort( $spam );
		return $spam;
	}

	/**
	 * A schema with its spam settings set back to a value from the undo list.
	 *
	 * @param array $schema Schema.
	 * @param mixed $before Earlier settings, or ABSENT.
	 */
	private static function withSpam( array $schema, $before ): array {
		if ( self::ABSENT === $before || ! is_array( $before ) ) {
			unset( $schema['metadata'][ SpamProtection::FORM_KEY ] );
		} else {
			$schema['metadata'][ SpamProtection::FORM_KEY ] = $before;
		}
		return $schema;
	}

	/**
	 * Clear the cached copies of a form.
	 *
	 * @param int $formId Form ID.
	 */
	private static function clearCache( int $formId ): void {
		wp_cache_delete( 'subtleforms_form_' . $formId, 'subtleforms' );
		wp_cache_delete( 'subtleforms_schema_' . $formId, 'subtleforms' );
	}
}
