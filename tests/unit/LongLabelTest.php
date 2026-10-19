<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * FLD2-12: a paragraph-long label is shortened in outputs, and the admin
 * label is used when one is set.
 *
 * @package SubtleForms\Tests
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Support\AnswerFormatter;
use SubtleForms\Support\FieldMapper;

/**
 * @covers \SubtleForms\Support\AnswerFormatter::label
 */
final class LongLabelTest extends TestCase {

	private function longLabel(): string {
		return trim( str_repeat( 'I have read the terms and conditions of this agreement in full. ', 24 ) );
	}

	public function test_long_public_label_is_shortened_in_outputs() {
		$label  = $this->longLabel();
		$this->assertGreaterThan( 1400, strlen( $label ) );
		$schema = array( 'fields' => array( array( 'type' => 'checkbox', 'key' => 'terms', 'label' => $label ) ) );

		$field = FieldMapper::fields( $schema )[0];
		$this->assertLessThanOrEqual( AnswerFormatter::LABEL_MAX, mb_strlen( $field['label'] ) );
		$this->assertStringStartsWith( 'I have read the terms', $field['label'] );
		$this->assertStringEndsWith( "\u{2026}", $field['label'] );
		// The public label itself is kept for the form.
		$this->assertSame( $label, $field['public_label'] );

		// Email line labels, CSV headers and the PDF use the same name.
		$this->assertSame( $field['label'], FieldMapper::answers( $schema, array( 'terms' => '1' ) )[0]['label'] );
		$this->assertSame( $field['label'], AnswerFormatter::display( $schema, array( 'terms' => '1' ) )['terms']['label'] );
	}

	public function test_admin_label_wins_and_short_labels_are_kept() {
		$this->assertSame( 'Terms', AnswerFormatter::label( array( 'label' => $this->longLabel(), 'adminLabel' => 'Terms' ) ) );
		$this->assertSame( 'Your email', AnswerFormatter::label( array( 'label' => 'Your email' ) ) );
		$this->assertSame( 'key_only', AnswerFormatter::label( array(), 'key_only' ) );
	}

	public function test_required_message_uses_a_short_name() {
		$schema = array(
			'fields' => array(
				array( 'type' => 'text', 'key' => 'terms', 'label' => $this->longLabel(), 'required' => true ),
			),
		);
		$result = ( new FieldValidator() )->validate( $schema, array( 'terms' => '' ), array( 'hidden_fields' => array(), 'required_fields' => array() ) );
		$this->assertFalse( $result['valid'] );
		$message = $result['errors']['terms'];
		$this->assertStringEndsWith( 'is required.', $message );
		$this->assertLessThan( 80, mb_strlen( $message ), $message );
	}
}
