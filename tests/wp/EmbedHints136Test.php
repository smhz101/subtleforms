<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.10.0 embed hints (#136): people who manage forms get a note where an
 * embed cannot show its form, visitors see exactly what they saw before, and
 * every drawn form container carries a message for visitors without JavaScript.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Blocks\SubtleFormsBlock;
use SubtleForms\Frontend\EmbedNotice;
use SubtleForms\Frontend\Shortcode;
use SubtleForms\Repositories\FormsRepository;

final class EmbedHints136Test extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		EmbedNotice::resetForTests();
	}

	private function shortcode( array $atts ): string {
		return \SubtleForms\Plugin::instance()->container()->get( Shortcode::class )->render( $atts );
	}

	private function draftForm(): int {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		( new FormsRepository() )->update( $id, array( 'status' => 'draft' ) );
		return $id;
	}

	private function admin(): void {
		wp_set_current_user( 1 );
	}

	private const VISITOR_MISSING = '<p class="subtleforms-error">Form not available.</p>';
	private const VISITOR_NO_ID   = '<p class="subtleforms-error">Invalid form ID.</p>';

	public function test_shortcode_missing_form_as_admin_says_not_found_and_shows_the_muted_line(): void {
		$this->admin();
		$out = $this->shortcode( array( 'id' => 999999 ) );
		$this->assertStringContainsString( 'form #999999 was not found', $out );
		$this->assertStringContainsString( 'Only people who can manage forms see this note.', $out );
		$this->assertStringContainsString( 'role="note"', $out );
	}

	public function test_shortcode_missing_form_as_visitor_is_unchanged(): void {
		wp_set_current_user( 0 );
		$this->assertSame( self::VISITOR_MISSING, $this->shortcode( array( 'id' => 999999 ) ) );
		$this->assertSame( self::VISITOR_NO_ID, $this->shortcode( array() ) );
		$this->assertSame( self::VISITOR_NO_ID, $this->shortcode( array( 'id' => 'abc' ) ) );
	}

	public function test_shortcode_draft_form_as_admin_links_to_the_builder(): void {
		$id = $this->draftForm();
		$this->admin();
		$out = $this->shortcode( array( 'id' => $id ) );
		$this->assertStringContainsString( 'is not published, so visitors do not see it', $out );
		$this->assertStringContainsString( 'page=subtleforms-new-form&#038;form_id=' . $id, $out );
		$this->assertStringContainsString( 'Open the form', $out );
		wp_set_current_user( 0 );
		$this->assertSame( self::VISITOR_MISSING, $this->shortcode( array( 'id' => $id ) ) );
	}

	public function test_shortcode_without_or_with_invalid_id_as_admin_gives_the_no_valid_id_note(): void {
		$this->admin();
		foreach ( array( array(), array( 'id' => 'abc' ), array( 'id' => '0' ) ) as $atts ) {
			$out = $this->shortcode( $atts );
			$this->assertStringContainsString( 'this embed has no valid form ID', $out );
			$this->assertStringContainsString( 'Only people who can manage forms see this note.', $out );
		}
	}

	public function test_block_gives_the_same_notes_to_admins_and_nothing_to_visitors(): void {
		$draft = $this->draftForm();
		$this->admin();
		$this->assertStringContainsString( 'form #999999 was not found', SubtleFormsBlock::render_block( array( 'formId' => 999999 ) ) );
		$out = SubtleFormsBlock::render_block( array( 'formId' => $draft ) );
		$this->assertStringContainsString( 'is not published, so visitors do not see it', $out );
		$this->assertStringContainsString( 'form_id=' . $draft, str_replace( '&#038;', '&', $out ) );
		$this->assertStringContainsString( 'this embed has no valid form ID', SubtleFormsBlock::render_block( array() ) );
		$this->assertStringContainsString( 'this embed has no valid form ID', SubtleFormsBlock::render_block( array( 'formId' => 0 ) ) );
		$this->assertStringNotContainsString( 'subtleforms-block-error', SubtleFormsBlock::render_block( array( 'formId' => 999999 ) ) );

		wp_set_current_user( 0 );
		$this->assertSame( '', SubtleFormsBlock::render_block( array( 'formId' => 999999 ) ) );
		$this->assertSame( '', SubtleFormsBlock::render_block( array( 'formId' => $draft ) ) );
		$this->assertSame( '', SubtleFormsBlock::render_block( array() ) );
	}

	public function test_the_note_stylesheet_is_printed_once_per_page(): void {
		$this->admin();
		$first  = $this->shortcode( array( 'id' => 999999 ) );
		$second = $this->shortcode( array( 'id' => 999998 ) );
		$this->assertSame( 1, substr_count( $first, 'id="subtleforms-embed-note-css"' ) );
		$this->assertSame( 0, substr_count( $second, 'id="subtleforms-embed-note-css"' ) );
	}

	public function test_a_published_forms_container_holds_a_noscript_message_for_its_own_form(): void {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		wp_set_current_user( 0 );
		foreach ( array( $this->shortcode( array( 'id' => $id ) ), SubtleFormsBlock::render_block( array( 'formId' => $id ) ) ) as $out ) {
			$this->assertMatchesRegularExpression( '/data-form-id="' . $id . '"[^>]*><noscript>/', $out );
			$this->assertStringContainsString( '<p class="subtleforms-noscript">This form needs JavaScript. Turn it on in your browser to fill it in.</p>', $out );
			$this->assertStringContainsString( '[data-form-id="' . $id . '"]', $out );
			$this->assertStringContainsString( '.subtleforms-skeleton{display:none!important}', $out );
			$this->assertStringNotContainsString( '@', strip_tags( $out ) );
		}
	}
}
