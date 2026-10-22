<?php
/**
 * Contact Form 7 forms on this site, read from their posts and post meta.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * `wpcf7_contact_form` posts. Works whether or not Contact Form 7 is active.
 */
final class Cf7Source implements Source {

	public const POST_TYPE = 'wpcf7_contact_form';

	/** @inheritDoc */
	public function id(): string {
		return 'cf7';
	}

	/** @inheritDoc */
	public function label(): string {
		return __( 'Contact Form 7', 'subtleforms' );
	}

	/** @inheritDoc */
	public function active(): bool {
		return defined( 'WPCF7_VERSION' ) || class_exists( 'WPCF7_ContactForm', false );
	}

	/** @inheritDoc */
	public function count(): int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts; the post type may not be registered.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE post_type = %s AND post_status NOT IN ('trash','auto-draft')", $wpdb->posts, self::POST_TYPE ) );
	}

	/** @inheritDoc */
	public function forms(): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts; the post type may not be registered.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT ID, post_title FROM %i WHERE post_type = %s AND post_status NOT IN ('trash','auto-draft') ORDER BY post_title ASC, ID ASC LIMIT 500", $wpdb->posts, self::POST_TYPE ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[] = array(
				'id'    => (string) $row['ID'],
				'title' => (string) $row['post_title'],
			);
		}
		return $out;
	}

	/** @inheritDoc */
	public function read( string $id ): ?array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's post.
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT ID, post_title, post_content FROM %i WHERE ID = %d AND post_type = %s AND post_status NOT IN ('trash','auto-draft')", $wpdb->posts, (int) $id, self::POST_TYPE ), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		$postId = (int) $row['ID'];
		$form   = get_post_meta( $postId, '_form', true );
		return array(
			'id'                  => (string) $postId,
			'title'               => (string) $row['post_title'],
			// Contact Form 7 keeps the template in _form; very old forms only
			// in the post content.
			'form'                => is_string( $form ) && '' !== $form ? $form : (string) $row['post_content'],
			'mail'                => self::meta( $postId, '_mail' ),
			'mail_2'              => self::meta( $postId, '_mail_2' ),
			'messages'            => self::meta( $postId, '_messages' ),
			'additional_settings' => (string) get_post_meta( $postId, '_additional_settings', true ),
		);
	}

	/**
	 * @param int    $postId Post.
	 * @param string $key    Meta key.
	 * @return array
	 */
	private static function meta( int $postId, string $key ): array {
		$value = get_post_meta( $postId, $key, true );
		return is_array( $value ) ? $value : array();
	}

	/** @inheritDoc */
	public function map( array $raw, array $context ): array {
		return Cf7Mapper::map( $raw, $context );
	}
}
