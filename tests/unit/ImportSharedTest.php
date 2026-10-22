<?php
/**
 * Importer pieces every source uses: the field table, keys, steps, the report.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/ImportTestCase.php';

use SubtleForms\Tools\Import\FieldMap;
use SubtleForms\Tools\Import\ImportNotes;
use SubtleForms\Tools\Import\SchemaBuilder;

/**
 * @covers \SubtleForms\Tools\Import\FieldMap
 * @covers \SubtleForms\Tools\Import\SchemaBuilder
 * @covers \SubtleForms\Tools\Import\ImportNotes
 */
final class ImportSharedTest extends ImportTestCase {

	/**
	 * docs/migrate.md lists every type in FieldMap, under its plugin, with
	 * the same target. The doc and the code cannot drift apart.
	 */
	public function test_the_doc_lists_every_mapped_and_skipped_type(): void {
		$doc      = (string) file_get_contents( dirname( __DIR__, 2 ) . '/docs/migrate.md' );
		$sections = array(
			'cf7'     => '### Contact Form 7',
			'gravity' => '### Gravity Forms',
			'fluent'  => '### Fluent Forms',
		);
		foreach ( $sections as $source => $heading ) {
			$start = strpos( $doc, $heading );
			$this->assertNotFalse( $start, $heading );
			$next = strpos( $doc, "\n### ", $start + 5 );
			$part = false === $next ? substr( $doc, $start ) : substr( $doc, $start, $next - $start );
			foreach ( FieldMap::table( $source ) as $type => $target ) {
				$this->assertMatchesRegularExpression( '/^\| `' . preg_quote( $type, '/' ) . '` \| /m', $part, "{$source} {$type} is in docs/migrate.md" );
				if ( '!' === $target[0] ) {
					$this->assertMatchesRegularExpression( '/^\| `' . preg_quote( $type, '/' ) . '` \| skipped \|/m', $part, "{$source} {$type} is listed as skipped" );
				}
			}
		}
	}

	public function test_targets_and_reasons(): void {
		$this->assertSame( 'phone', FieldMap::target( 'cf7', 'tel' ) );
		$this->assertSame( 'name_group', FieldMap::target( 'gravity', 'NAME' ) );
		$this->assertSame( '', FieldMap::target( 'gravity', 'product' ) );
		$this->assertSame( '', FieldMap::target( 'fluent', 'made_up' ) );
		$this->assertSame( 'payments are not imported', FieldMap::reason( 'gravity', 'product' ) );
		$this->assertSame( 'this field type has no SubtleForms equivalent', FieldMap::reason( 'fluent', 'made_up' ) );
		$this->assertSame(
			"Gravity Forms field 'Product' (type product) was skipped: payments are not imported.",
			FieldMap::skippedLine( 'gravity', 'Product', 'product' )
		);
	}

	public function test_keys_keep_valid_incoming_names_and_never_repeat(): void {
		$build = new SchemaBuilder( new ImportNotes() );
		$this->assertSame( 'your-name', $build->key( 'your-name', 'Your name' ) );
		$this->assertSame( 'your_name', $build->key( 'your-name', 'Your name' ), 'A used name falls back to the label.' );
		$this->assertSame( 'your_name_2', $build->key( '', 'Your name' ) );
		$this->assertSame( 'field_7', $build->key( '7bad', '!!!', '7' ) );
		$this->assertSame( 'field_website_url', $build->key( 'website_url', 'website url' ), 'Reserved keys are never used.' );
	}

	public function test_steps_hold_the_fields_before_and_after_each_break(): void {
		$build  = new SchemaBuilder( new ImportNotes() );
		$a      = $build->field( 'text', 'a', 'A' );
		$b      = $build->field( 'text', 'b', 'B' );
		$c      = $build->field( 'text', 'c', 'C' );
		$fields = $build->assemble( array( $a, SchemaBuilder::stepMarker( 'Second' ), $b, SchemaBuilder::stepMarker( '' ), $c ), array( 'First' ) );
		$this->assertSame( array( 'First', 'Second', 'Step 3' ), array_column( $fields, 'title' ) );
		$this->assertSame( array( 'a' ), array_column( $fields[0]['children'], 'key' ) );
		$this->assertSame( array( 'b' ), array_column( $fields[1]['children'], 'key' ) );
		$this->assertSame( array( 'c' ), array_column( $fields[2]['children'], 'key' ) );
		$this->assertSame( array( $a, $b ), $build->assemble( array( $a, $b ) ), 'Without a break the list is unchanged.' );
		$schema = SchemaBuilder::schema( 'T', '', $fields );
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		self::assertSavable( $schema );
	}

	public function test_long_text_is_shortened_and_reported(): void {
		$notes = new ImportNotes();
		$build = new SchemaBuilder( $notes );
		$field = $build->field( 'text', 'a', 'Long', false, array( 'placeholder' => str_repeat( 'x', 300 ), 'description' => '' ) );
		$this->assertSame( 255, strlen( $field['placeholder'] ) );
		$this->assertArrayNotHasKey( 'description', $field, 'Empty settings are left out.' );
		$this->assertStringContainsString( "The placeholder of 'Long' was shortened to 255 characters.", implode( ' ', $notes->strings() ) );
	}

	public function test_headers_with_answers_are_reported_and_others_kept(): void {
		$notes   = new ImportNotes();
		$headers = SchemaBuilder::headers(
			array(
				'From'     => 'Shop <shop@example.com>',
				'Reply-To' => array( '{field:email}', '[your-email]' ),
				'Cc'       => " a@example.com\r\nBcc: injected@example.com ",
			),
			'Mail',
			$notes
		);
		$this->assertSame( array( 'From: Shop <shop@example.com>', 'Cc: a@example.com Bcc: injected@example.com' ), $headers, 'Line breaks never start a new header.' );
		$this->assertStringContainsString( 'The Reply-To address "[your-email]"', implode( ' ', $notes->strings() ) );
	}

	public function test_reply_to_keeps_one_answer_or_one_address_and_reports_the_rest(): void {
		$notes = new ImportNotes();
		$cases = array(
			array( array( '{field:email}', '[your-email]' ), '{field:email}' ),
			array( 'owner@example.com', 'owner@example.com' ),
			array( array( 'Team {field:email}', 'Team [your-email]' ), '' ),
			array( 'a@example.com, b@example.com', '' ),
			array( array( '[unknown-field]', '[unknown-field]' ), '' ),
		);
		foreach ( $cases as $i => $case ) {
			$headers = array( 'From' => 'x@example.com', 'Reply-To' => $case[0] );
			$this->assertSame( $case[1], SchemaBuilder::replyTo( $headers, 'Mail', $notes ), "case {$i}" );
			$this->assertSame( array( 'From' => 'x@example.com' ), $headers, 'Reply-To never stays a header.' );
		}
		$report = implode( "\n", $notes->strings() );
		$this->assertStringContainsString( 'The Reply-To "Team [your-email]" of the email \'Mail\' was not copied', $report );
		$this->assertStringContainsString( 'The Reply-To "a@example.com, b@example.com"', $report );
		$this->assertSame( 3, $notes->count() );
	}

	public function test_the_report_counts_lines_that_need_attention_once(): void {
		$notes = new ImportNotes();
		$notes->skipped( 'A' );
		$notes->skipped( 'A' );
		$notes->changed( 'B' );
		$notes->info( 'C' );
		$this->assertSame( 2, $notes->count() );
		$this->assertSame( array( 'A', 'B', 'C' ), $notes->strings() );
		$this->assertSame( 'changed', $notes->all()[1]['level'] );
	}

	public function test_repeated_part_tags_read_once(): void {
		$this->assertSame( 'Hi {field:name}!', SchemaBuilder::collapseTags( 'Hi {field:name} {field:name}!' ) );
		$this->assertSame( '{field:a} {field:b}', SchemaBuilder::collapseTags( '{field:a} {field:b}' ) );
	}

	public function test_counting_fields_skips_steps_and_layout(): void {
		$fields = array(
			array( 'key' => 's', 'type' => 'step', 'children' => array( array( 'key' => 'a', 'type' => 'text' ), array( 'key' => 'h', 'type' => 'html' ) ) ),
			array( 'key' => 'b', 'type' => 'email' ),
			array( 'key' => 'c', 'type' => 'section_break' ),
		);
		$this->assertSame( 2, SchemaBuilder::countFields( $fields ) );
	}
}
