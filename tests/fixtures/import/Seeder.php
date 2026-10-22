<?php
// phpcs:disable -- Test fixture; not shipped in production plugin.
/**
 * Put the import fixtures on a test site the way each plugin stores them:
 * Contact Form 7 posts with their meta, Gravity Forms and Fluent Forms rows in
 * their own tables (created when missing). Used by the WP suite and, through
 * tests/browser/fixtures/import-seed.php, by the browser tests.
 *
 * @package SubtleForms\Tests
 */

namespace SubtleForms\Tests\Fixtures;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class ImportSeeder {

	/** Option that remembers what was seeded, so clean() removes only that. */
	public const OPTION = 'subtleforms_test_import_seed';

	/**
	 * @param string $name Fixture file.
	 * @return array
	 */
	public static function fixture( string $name ): array {
		return (array) json_decode( (string) file_get_contents( __DIR__ . '/' . $name ), true );
	}

	/**
	 * Seed every fixture.
	 *
	 * @return array{cf7: int[], gravity: int[], fluent: int[]}
	 */
	public static function seed(): array {
		$state = self::state();
		$ids   = array(
			'cf7'     => array( self::cf7( 'cf7-contact.json' ), self::cf7( 'cf7-visit.json' ) ),
			'gravity' => array( self::gravity( 'gf-application.json', $state ) ),
			'fluent'  => array( self::fluent( 'fluent-booking.json', $state ) ),
		);
		foreach ( $ids as $source => $list ) {
			$state['ids'][ $source ] = array_values( array_unique( array_merge( $state['ids'][ $source ] ?? array(), $list ) ) );
		}
		update_option( self::OPTION, $state, false );
		return $ids;
	}

	/**
	 * Remove what seed() added; drop the tables it created.
	 */
	public static function clean(): void {
		global $wpdb;
		$state = self::state();
		foreach ( $state['ids']['cf7'] ?? array() as $id ) {
			wp_delete_post( (int) $id, true );
		}
		foreach ( array( 'gravity' => array( 'gf_form', 'gf_form_meta', 'form_id' ), 'fluent' => array( 'fluentform_forms', 'fluentform_form_meta', 'form_id' ) ) as $source => $tables ) {
			$form = $wpdb->prefix . $tables[0];
			$meta = $wpdb->prefix . $tables[1];
			if ( in_array( $form, $state['created'], true ) ) {
				continue;
			}
			foreach ( $state['ids'][ $source ] ?? array() as $id ) {
				$wpdb->delete( $form, array( 'id' => (int) $id ) );
				$wpdb->delete( $meta, array( $tables[2] => (int) $id ) );
			}
		}
		foreach ( $state['created'] as $table ) {
			$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" );
		}
		delete_option( self::OPTION );
	}

	/**
	 * @return array{created: string[], ids: array}
	 */
	private static function state(): array {
		$state = get_option( self::OPTION, array() );
		$state = is_array( $state ) ? $state : array();
		return array(
			'created' => (array) ( $state['created'] ?? array() ),
			'ids'     => (array) ( $state['ids'] ?? array() ),
		);
	}

	/**
	 * A Contact Form 7 post with its meta.
	 *
	 * @param string $file Fixture.
	 * @return int Post ID.
	 */
	public static function cf7( string $file ): int {
		$data = self::fixture( $file );
		$id   = wp_insert_post(
			array(
				'post_type'    => 'wpcf7_contact_form',
				'post_status'  => 'publish',
				'post_title'   => $data['title'],
				'post_content' => $data['form'],
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			throw new \RuntimeException( $id->get_error_message() );
		}
		update_post_meta( $id, '_form', wp_slash( $data['form'] ) );
		update_post_meta( $id, '_mail', wp_slash( $data['mail'] ) );
		update_post_meta( $id, '_mail_2', wp_slash( $data['mail_2'] ) );
		update_post_meta( $id, '_messages', wp_slash( $data['messages'] ) );
		update_post_meta( $id, '_additional_settings', wp_slash( $data['additional_settings'] ) );
		update_post_meta( $id, '_locale', 'en_US' );
		return (int) $id;
	}

	/**
	 * A Gravity Forms form in wp_gf_form and wp_gf_form_meta.
	 *
	 * @param string $file  Fixture.
	 * @param array  $state Seed state, by reference.
	 * @return int Form ID.
	 */
	public static function gravity( string $file, array &$state ): int {
		global $wpdb;
		$form = $wpdb->prefix . 'gf_form';
		$meta = $wpdb->prefix . 'gf_form_meta';
		self::create(
			$form,
			"CREATE TABLE `{$form}` (
				id mediumint(10) unsigned NOT NULL AUTO_INCREMENT,
				title varchar(150) NOT NULL,
				date_created datetime NOT NULL,
				date_updated datetime DEFAULT NULL,
				is_active tinyint(10) NOT NULL DEFAULT 1,
				is_trash tinyint(10) NOT NULL DEFAULT 0,
				PRIMARY KEY  (id)
			)",
			$state
		);
		self::create(
			$meta,
			"CREATE TABLE `{$meta}` (
				form_id mediumint(10) unsigned NOT NULL,
				display_meta longtext,
				entries_grid_meta mediumtext,
				confirmations longtext,
				notifications longtext,
				PRIMARY KEY  (form_id)
			)",
			$state
		);
		$data = self::fixture( $file );
		$wpdb->insert(
			$form,
			array(
				'title'        => $data['form']['title'],
				'date_created' => $data['form']['date_created'],
				'is_active'    => 1,
				'is_trash'     => 0,
			)
		);
		$id                         = (int) $wpdb->insert_id;
		$data['display_meta']['id'] = $id;
		$wpdb->insert(
			$meta,
			array(
				'form_id'       => $id,
				'display_meta'  => wp_json_encode( $data['display_meta'] ),
				'confirmations' => wp_json_encode( $data['confirmations'] ),
				'notifications' => wp_json_encode( $data['notifications'] ),
			)
		);
		return $id;
	}

	/**
	 * A Fluent Forms form in wp_fluentform_forms and wp_fluentform_form_meta.
	 *
	 * @param string $file  Fixture.
	 * @param array  $state Seed state, by reference.
	 * @return int Form ID.
	 */
	public static function fluent( string $file, array &$state ): int {
		global $wpdb;
		$form = $wpdb->prefix . 'fluentform_forms';
		$meta = $wpdb->prefix . 'fluentform_form_meta';
		self::create(
			$form,
			"CREATE TABLE `{$form}` (
				id int(10) unsigned NOT NULL AUTO_INCREMENT,
				title varchar(255) NOT NULL,
				status varchar(45) DEFAULT 'Draft',
				appearance_settings text,
				form_fields longtext,
				has_payment tinyint(1) NOT NULL DEFAULT 0,
				type varchar(45) DEFAULT NULL,
				conditions text,
				created_by int(11) DEFAULT NULL,
				created_at timestamp NULL DEFAULT NULL,
				updated_at timestamp NULL DEFAULT NULL,
				PRIMARY KEY  (id)
			)",
			$state
		);
		self::create(
			$meta,
			"CREATE TABLE `{$meta}` (
				id int(10) unsigned NOT NULL AUTO_INCREMENT,
				form_id int(10) unsigned DEFAULT NULL,
				meta_key varchar(255) NOT NULL,
				value longtext,
				PRIMARY KEY  (id)
			)",
			$state
		);
		$data = self::fixture( $file );
		$wpdb->insert(
			$form,
			array(
				'title'       => $data['form']['title'],
				'status'      => $data['form']['status'],
				'form_fields' => wp_json_encode( $data['form']['form_fields'] ),
				'has_payment' => (int) $data['form']['has_payment'],
				'type'        => $data['form']['type'],
				'created_by'  => 1,
				'created_at'  => $data['form']['created_at'],
				'updated_at'  => $data['form']['updated_at'],
			)
		);
		$id = (int) $wpdb->insert_id;
		foreach ( $data['meta'] as $row ) {
			$wpdb->insert(
				$meta,
				array(
					'form_id'  => $id,
					'meta_key' => $row['meta_key'],
					'value'    => is_string( $row['value'] ) ? $row['value'] : wp_json_encode( $row['value'] ),
				)
			);
		}
		return $id;
	}

	/**
	 * Create a table when it is missing and remember that we did.
	 *
	 * @param string $table Table.
	 * @param string $sql   CREATE TABLE statement.
	 * @param array  $state Seed state, by reference.
	 */
	private static function create( string $table, string $sql, array &$state ): void {
		global $wpdb;
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table ) {
			return;
		}
		$wpdb->query( $sql );
		if ( ! in_array( $table, $state['created'], true ) ) {
			$state['created'][] = $table;
		}
	}
}
