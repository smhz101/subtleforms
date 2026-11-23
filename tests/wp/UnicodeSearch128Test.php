<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.9.2 (#128): entry search finds Arabic, Chinese and Cyrillic answers, in
 * entries written the old way (\uXXXX escapes) and the new way (readable).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\SubmissionsRepository;

final class UnicodeSearch128Test extends TestCase {

	/** @var int */
	private $form;

	/** @var int Entry saved before the fix (escaped). */
	private $oldId;

	/** @var int Entry saved through create() (readable). */
	private $newId;

	/** @var int Entry with Latin text only. */
	private $latinId;

	protected function setUp(): void {
		parent::setUp();
		global $wpdb;

		$this->form = $this->publish( array( array( 'id' => 'a1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );

		$answers = array(
			'name'  => 'محمد Khan',
			'city'  => '田中 Tokyo',
			'other' => 'Петров',
		);

		// Pre-fix row: encoded with no flags, as 2.9.1 did.
		$wpdb->insert(
			$wpdb->prefix . 'subtleforms_submissions',
			array(
				'form_id'    => $this->form,
				'payload'    => wp_json_encode( $answers ),
				'meta'       => wp_json_encode( array() ),
				'status'     => 'unread',
				'created_at' => current_time( 'mysql', true ),
			)
		);
		$this->oldId = (int) $wpdb->insert_id;

		$repo        = new SubmissionsRepository();
		$this->newId = $repo->create(
			array(
				'form_id' => $this->form,
				'payload' => $answers,
			)
		);

		$this->latinId = $repo->create(
			array(
				'form_id' => $this->form,
				'payload' => array( 'name' => 'Ayesha Watanabe' ),
			)
		);
	}

	private function searchIds( string $term ): array {
		$repo = new SubmissionsRepository();
		$rows = $repo->findAll( array( 'form_id' => $this->form, 'search' => $term, 'limit' => 50 ) );
		$ids  = array_map( 'intval', array_column( $rows, 'id' ) );
		sort( $ids );
		return $ids;
	}

	private function searchCount( string $term ): int {
		return ( new SubmissionsRepository() )->count( array( 'form_id' => $this->form, 'search' => $term ) );
	}

	public function test_non_latin_search_finds_old_and_new_entries() {
		$both = array( $this->oldId, $this->newId );
		sort( $both );

		foreach ( array( 'محمد', '田中', 'Петров', 'محمد Khan', '田中 Tokyo' ) as $term ) {
			$this->assertSame( $both, $this->searchIds( $term ), "list for {$term}" );
			$this->assertSame( 2, $this->searchCount( $term ), "count for {$term}" );
		}
	}

	public function test_latin_search_still_returns_the_right_entries() {
		$this->assertSame( array( $this->latinId ), $this->searchIds( 'Ayesha' ) );
		$this->assertSame( 1, $this->searchCount( 'Ayesha' ) );

		$khan = array( $this->oldId, $this->newId );
		sort( $khan );
		$this->assertSame( $khan, $this->searchIds( 'Khan' ) );
		$this->assertSame( 2, $this->searchCount( 'Khan' ) );
		$this->assertSame( array(), $this->searchIds( 'Nobody' ) );
	}

	public function test_field_value_filter_without_a_key_finds_both_spellings() {
		$repo = new SubmissionsRepository();
		$args = array( 'form_id' => $this->form, 'field_value' => 'محمد' );
		$this->assertCount( 2, $repo->findAll( $args ) );
		$this->assertSame( 2, $repo->count( $args ) );
	}

	public function test_new_entries_are_stored_readable() {
		global $wpdb;
		$raw = (string) $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $this->newId ) );
		$this->assertStringContainsString( 'محمد', $raw );
		$this->assertStringNotContainsString( '\\u', $raw );

		$old = (string) $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $this->oldId ) );
		$this->assertStringContainsString( '\\u0645', $old, 'old rows are not rewritten' );
	}

	public function test_edited_entry_is_stored_readable_and_found() {
		global $wpdb;
		$repo = new SubmissionsRepository();
		$repo->update( $this->latinId, array( 'payload' => array( 'name' => 'Петров Ali' ) ) );
		$raw = (string) $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $this->latinId ) );
		$this->assertStringContainsString( 'Петров', $raw );
		$this->assertContains( $this->latinId, $this->searchIds( 'Петров' ) );
	}

	public function test_percent_and_underscore_are_literal() {
		$this->assertSame( array(), $this->searchIds( 'محمد%' ) );
		$this->assertSame( array(), $this->searchIds( '田_中' ) );
	}

	public function test_three_byte_charset_keeps_emoji_entries_escaped_but_searchable() {
		global $wpdb;
		$force = static function () {
			return 'utf8';
		};
		add_filter( 'pre_get_col_charset', $force );
		try {
			$id = ( new SubmissionsRepository() )->create(
				array(
					'form_id' => $this->form,
					'payload' => array( 'name' => "محمد \u{1F600}" ),
				)
			);
		} finally {
			remove_filter( 'pre_get_col_charset', $force );
		}
		$raw = (string) $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $id ) );
		$this->assertStringContainsString( '\\ud83d\\ude00', $raw, 'four-byte text is escaped on a three-byte table' );
		$this->assertContains( $id, $this->searchIds( 'محمد' ) );
		$this->assertContains( $id, $this->searchIds( "محمد \u{1F600}" ) );
	}
}
