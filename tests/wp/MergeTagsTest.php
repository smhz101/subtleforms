<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.3.0 feature 18: email merge tags in single and double braces.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\MergeTags;

final class MergeTagsTest extends TestCase {

	private function context( array $answers ): array {
		$schema = array(
			'fields' => array(
				array( 'key' => 'name', 'type' => 'text', 'label' => 'Your name' ),
				array( 'key' => 'notes', 'type' => 'textarea', 'label' => 'Notes' ),
				array( 'key' => 'pw', 'type' => 'password', 'label' => 'Password' ),
				array( 'key' => 'empty', 'type' => 'text', 'label' => 'Left empty' ),
			),
		);
		return array(
			'answers'    => $answers,
			'fields'     => FieldMapper::fields( $schema ),
			'form_title' => 'Contact & more',
			'entry_id'   => 42,
			'date'       => 'October 11, 2026 9:00 am',
		);
	}

	public function test_single_and_double_braces_are_both_supported() {
		$ctx = $this->context( array( 'name' => 'Ada' ) );
		foreach ( array( '{name}', '{{name}}', '{field:name}', '{{field:name}}', '{{ name }}' ) as $tag ) {
			$this->assertSame( 'Hi Ada', MergeTags::render( "Hi {$tag}", $ctx ), $tag );
		}
	}

	public function test_global_tags() {
		$ctx = $this->context( array() );
		$this->assertSame( 'Contact & more #42', MergeTags::render( '{form_title} #{entry_id}', $ctx ) );
		$this->assertSame( 'Contact &amp; more', MergeTags::render( '{{form_title}}', $ctx, true ) );
		$this->assertSame( get_option( 'admin_email' ), MergeTags::render( '{admin_email}', $ctx ) );
		$this->assertSame( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ), MergeTags::render( '{{site_name}}', $ctx ) );
		$this->assertSame( 'October 11, 2026 9:00 am', MergeTags::render( '{date}', $ctx ) );
	}

	public function test_unknown_tags() {
		$ctx = $this->context( array() );
		$this->assertSame( 'a  b', MergeTags::render( 'a {{nope}} b', $ctx ), 'double braces: empty, as before 2.3' );
		$this->assertSame( 'a {nope} b', MergeTags::render( 'a {nope} b', $ctx ), 'single braces: left as written' );
		$this->assertSame( 'x', MergeTags::render( 'x{field:missing}', $ctx ) );
	}

	public function test_all_fields_text_and_html() {
		$ctx  = $this->context( array( 'name' => 'Ada', 'notes' => "One\nTwo", 'pw' => 'secret', 'empty' => '' ) );
		$text = MergeTags::render( '{all_fields}', $ctx );
		$this->assertSame( "Your name: Ada\nNotes: \nOne\nTwo", $text );
		$this->assertStringNotContainsString( 'secret', $text );
		$this->assertStringNotContainsString( 'Left empty', $text );

		$html = MergeTags::render( '{{all_fields}}', $ctx, true );
		$this->assertStringContainsString( '<table', $html );
		$this->assertStringContainsString( '>Your name</th>', $html );
		$this->assertStringNotContainsString( 'Password', $html );
	}
}
