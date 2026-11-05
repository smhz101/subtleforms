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
	 * @return array{cf7: int[], gravity: int[], fluent: int[], wpforms: int[], ninja: int[], ninja_fields: array}
	 */
	public static function seed(): array {
		$state = self::state();
		$ids   = array(
			'cf7'     => array( self::cf7( 'cf7-contact.json' ), self::cf7( 'cf7-visit.json' ) ),
			'gravity' => array( self::gravity( 'gf-application.json', $state ) ),
			'fluent'  => array( self::fluent( 'fluent-booking.json', $state ) ),
			'wpforms' => array( self::wpforms( 'wpforms-contact.json', $state ) ),
		);
		$ninja                = self::ninja( 'ninja-contact.json', $state );
		$ids['ninja']         = array( $ninja['id'] );
		$ids['ninja_fields']  = $ninja['fields'];
		foreach ( $ids as $source => $list ) {
			if ( 'ninja_fields' === $source ) {
				continue;
			}
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
		foreach ( $state['ids']['wpforms'] ?? array() as $id ) {
			wp_delete_post( (int) $id, true );
			$entries = $wpdb->prefix . 'wpforms_entries';
			if ( ! in_array( $entries, $state['created'], true ) && $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $entries ) ) === $entries ) {
				$wpdb->delete( $entries, array( 'form_id' => (int) $id ) );
			}
		}
		foreach ( $state['ids']['ninja'] ?? array() as $id ) {
			$subs = $wpdb->get_col( $wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_form_id' AND meta_value = %s", (string) $id ) );
			foreach ( $subs as $sub ) {
				wp_delete_post( (int) $sub, true );
			}
			$forms = $wpdb->prefix . 'nf3_forms';
			if ( ! in_array( $forms, $state['created'], true ) ) {
				$fieldIds  = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}nf3_fields WHERE parent_id = %d", (int) $id ) );
				$actionIds = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}nf3_actions WHERE parent_id = %d", (int) $id ) );
				foreach ( $fieldIds as $fid ) {
					$wpdb->delete( $wpdb->prefix . 'nf3_field_meta', array( 'parent_id' => (int) $fid ) );
				}
				foreach ( $actionIds as $aid ) {
					$wpdb->delete( $wpdb->prefix . 'nf3_action_meta', array( 'parent_id' => (int) $aid ) );
				}
				$wpdb->delete( $wpdb->prefix . 'nf3_fields', array( 'parent_id' => (int) $id ) );
				$wpdb->delete( $wpdb->prefix . 'nf3_actions', array( 'parent_id' => (int) $id ) );
				$wpdb->delete( $wpdb->prefix . 'nf3_form_meta', array( 'parent_id' => (int) $id ) );
				$wpdb->delete( $forms, array( 'id' => (int) $id ) );
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
	 * A WPForms form as a `wpforms` post, with Pro-style entries in
	 * wp_wpforms_entries (WPForms Lite has no such table).
	 *
	 * @param string $file  Fixture.
	 * @param array  $state Seed state, by reference.
	 * @return int Post ID.
	 */
	public static function wpforms( string $file, array &$state ): int {
		global $wpdb;
		$data = self::fixture( $file );
		$id   = wp_insert_post(
			array(
				'post_type'    => 'wpforms',
				'post_status'  => 'publish',
				'post_title'   => $data['settings']['form_title'],
				'post_content' => wp_slash( wp_json_encode( $data ) ),
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			throw new \RuntimeException( $id->get_error_message() );
		}
		$table = $wpdb->prefix . 'wpforms_entries';
		self::create(
			$table,
			"CREATE TABLE `{$table}` (
				entry_id bigint(20) NOT NULL AUTO_INCREMENT,
				form_id bigint(20) NOT NULL,
				post_id bigint(20) NOT NULL DEFAULT 0,
				user_id bigint(20) NOT NULL DEFAULT 0,
				status varchar(30) NOT NULL DEFAULT '',
				type varchar(30) NOT NULL DEFAULT '',
				viewed tinyint(1) DEFAULT 0,
				starred tinyint(1) DEFAULT 0,
				fields longtext NOT NULL,
				meta longtext,
				date datetime NOT NULL,
				date_modified datetime NOT NULL,
				ip_address varchar(128) NOT NULL DEFAULT '',
				user_agent varchar(256) NOT NULL DEFAULT '',
				user_uuid varchar(36) NOT NULL DEFAULT '',
				PRIMARY KEY  (entry_id)
			)",
			$state
		);
		foreach ( self::fixture( 'wpforms-entries.json' ) as $entry ) {
			self::wpformsEntry( (int) $id, $entry );
		}
		return (int) $id;
	}

	/**
	 * One Pro entry row.
	 *
	 * @param int   $formId Form post ID.
	 * @param array $entry  date, ip, ua, status, fields.
	 */
	public static function wpformsEntry( int $formId, array $entry ): void {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'wpforms_entries',
			array(
				'form_id'       => $formId,
				'status'        => $entry['status'] ?? '',
				'type'          => 'entry',
				'viewed'        => 0,
				'fields'        => wp_json_encode( $entry['fields'] ),
				'date'          => $entry['date'],
				'date_modified' => $entry['date'],
				'ip_address'    => $entry['ip'] ?? '',
				'user_agent'    => $entry['ua'] ?? '',
			)
		);
	}

	/**
	 * A Ninja Forms form in the nf3_ tables, with entries as nf_sub posts.
	 *
	 * @param string $file  Fixture.
	 * @param array  $state Seed state, by reference.
	 * @return array{id: int, fields: array<int, int>} Form ID, and new field id by fixture field id.
	 */
	public static function ninja( string $file, array &$state ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		foreach (
			array(
				'nf3_forms'       => 'id int(11) NOT NULL AUTO_INCREMENT, title longtext, `key` longtext, created_at timestamp NULL, updated_at timestamp NULL, views int(11), subs int(11), PRIMARY KEY  (id)',
				'nf3_form_meta'   => 'id int(11) NOT NULL AUTO_INCREMENT, parent_id int(11) NOT NULL, `key` longtext NOT NULL, value longtext, meta_key longtext, meta_value longtext, PRIMARY KEY  (id)',
				'nf3_fields'      => 'id int(11) NOT NULL AUTO_INCREMENT, label longtext, `key` longtext, type longtext, parent_id int(11) NOT NULL, field_label longtext, field_key longtext, `order` int(11), required bit(1), default_value longtext, label_pos varchar(15), personally_identifiable bit(1), PRIMARY KEY  (id)',
				'nf3_field_meta'  => 'id int(11) NOT NULL AUTO_INCREMENT, parent_id int(11) NOT NULL, `key` longtext NOT NULL, value longtext, meta_key longtext, meta_value longtext, PRIMARY KEY  (id)',
				'nf3_actions'     => 'id int(11) NOT NULL AUTO_INCREMENT, title longtext, `key` longtext, type longtext, active tinyint(1) DEFAULT 1, parent_id int(11) NOT NULL, label longtext, PRIMARY KEY  (id)',
				'nf3_action_meta' => 'id int(11) NOT NULL AUTO_INCREMENT, parent_id int(11) NOT NULL, `key` longtext NOT NULL, value longtext, meta_key longtext, meta_value longtext, PRIMARY KEY  (id)',
			) as $name => $columns
		) {
			self::create( $p . $name, "CREATE TABLE `{$p}{$name}` ( {$columns} )", $state );
		}
		$data = self::fixture( $file );
		$wpdb->insert( $p . 'nf3_forms', array( 'title' => $data['form']['title'] ) );
		$formId = (int) $wpdb->insert_id;
		foreach ( $data['form_meta'] as $meta ) {
			$wpdb->insert( $p . 'nf3_form_meta', array( 'parent_id' => $formId, 'key' => $meta['key'], 'value' => $meta['value'] ) );
		}
		$map = array();
		foreach ( $data['fields'] as $field ) {
			$wpdb->insert(
				$p . 'nf3_fields',
				array(
					'label'     => $field['label'],
					'key'       => $field['key'],
					'type'      => $field['type'],
					'parent_id' => $formId,
					'order'     => $field['order'],
				)
			);
			$fieldId           = (int) $wpdb->insert_id;
			$map[ $field['id'] ] = $fieldId;
			foreach ( $field['meta'] as $key => $value ) {
				$wpdb->insert( $p . 'nf3_field_meta', array( 'parent_id' => $fieldId, 'key' => $key, 'value' => is_array( $value ) ? serialize( $value ) : (string) $value ) );
			}
		}
		foreach ( $data['actions'] as $action ) {
			$wpdb->insert(
				$p . 'nf3_actions',
				array(
					'title'     => $action['label'],
					'key'       => '',
					'type'      => $action['type'],
					'active'    => $action['active'],
					'parent_id' => $formId,
					'label'     => $action['label'],
				)
			);
			$actionId = (int) $wpdb->insert_id;
			foreach ( $action['meta'] as $key => $value ) {
				$wpdb->insert( $p . 'nf3_action_meta', array( 'parent_id' => $actionId, 'key' => $key, 'value' => is_array( $value ) ? serialize( $value ) : (string) $value ) );
			}
		}
		foreach ( self::fixture( 'ninja-entries.json' ) as $entry ) {
			self::ninjaEntry( $formId, $map, $entry );
		}
		return array( 'id' => $formId, 'fields' => $map );
	}

	/**
	 * One Ninja Forms submission post.
	 *
	 * @param int   $formId Form ID.
	 * @param array $map    New field id by fixture field id.
	 * @param array $entry  date, status, values by fixture field id.
	 * @return int Post ID.
	 */
	public static function ninjaEntry( int $formId, array $map, array $entry ): int {
		$post = wp_insert_post(
			array(
				'post_type'     => 'nf_sub',
				'post_status'   => $entry['status'],
				'post_title'    => 'Submission',
				'post_date'     => $entry['date'],
				'post_date_gmt' => $entry['date'],
			)
		);
		update_post_meta( $post, '_form_id', (string) $formId );
		foreach ( $entry['values'] as $fixtureId => $value ) {
			update_post_meta( $post, '_field_' . $map[ (int) $fixtureId ], $value );
		}
		return (int) $post;
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
