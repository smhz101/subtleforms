<?php
/**
 * Contact Form 7 import: form-tag parsing, field mapping, mail and messages.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/ImportTestCase.php';

use SubtleForms\Tools\Import\Cf7Mapper;
use SubtleForms\Tools\Import\Cf7Parser;

/**
 * @covers \SubtleForms\Tools\Import\Cf7Parser
 * @covers \SubtleForms\Tools\Import\Cf7Mapper
 */
final class ImportCf7Test extends ImportTestCase {

	public function test_the_parser_reads_type_name_options_values_and_pipes(): void {
		$tag = Cf7Parser::tag( 'select*', 'menu-1 multiple include_blank class:big "Morning|am" \'Evening\'' );
		$this->assertSame( 'select', $tag['basetype'] );
		$this->assertTrue( $tag['required'] );
		$this->assertSame( 'menu-1', $tag['name'] );
		$this->assertSame( array( 'multiple', 'include_blank', 'class:big' ), $tag['options'] );
		$this->assertSame( array( 'Morning|am', 'Evening' ), $tag['values'] );
		$this->assertTrue( Cf7Parser::option( $tag, 'multiple' ) );
		$this->assertSame( 'big', Cf7Parser::option( $tag, 'class' ) );
		$this->assertNull( Cf7Parser::option( $tag, 'placeholder' ) );
		$this->assertSame( array( 'label' => 'Morning', 'value' => 'am' ), Cf7Parser::pipe( 'Morning|am' ) );

		$submit = Cf7Parser::tag( 'submit', '"Send it"' );
		$this->assertSame( '', $submit['name'] );
		$this->assertSame( array( 'Send it' ), $submit['values'] );
	}

	public function test_labels_come_from_the_text_before_each_tag(): void {
		$items = Cf7Parser::parse( "<p>Your Name (required)<br />\n [text* your-name] </p>\n<label>Email *\n[email your-email]</label>\n[[text escaped]]\n<p>Closing words.</p>" );
		$tags  = array_values( array_filter( $items, static fn( $i ) => 'tag' === $i['kind'] ) );
		$this->assertSame( 'Your Name', $tags[0]['label'] );
		$this->assertSame( 'Email', $tags[1]['label'] );
		$this->assertCount( 2, $tags, 'An escaped [[tag]] is text, not a field.' );
		$texts = array_values( array_filter( $items, static fn( $i ) => 'text' === $i['kind'] ) );
		$this->assertStringContainsString( 'Closing words.', end( $texts )['html'] );
	}

	public function test_the_default_contact_form_maps_field_by_field(): void {
		$mapped = Cf7Mapper::map( self::fixture( 'cf7-contact.json' ), self::CONTEXT );
		$schema = $mapped['schema'];
		$fields = self::byKey( $schema['fields'] );

		$this->assertSame( 'Contact form 1', $mapped['title'] );
		$this->assertSame( array( 'your-name', 'your-email', 'your-subject', 'your-message' ), array_keys( $fields ) );
		$this->assertSame( array( 'text', 'email', 'text', 'textarea' ), array_column( $schema['fields'], 'type' ) );
		$this->assertSame( array( 'Your name', 'Your email', 'Subject', 'Your message' ), array_column( $schema['fields'], 'label' ) );
		$this->assertSame( array( true, true, true, false ), array_column( $schema['fields'], 'required' ) );
		$this->assertSame( 'Submit', $schema['metadata']['submitText'] );
		$this->assertSame( 'regular', $schema['metadata']['type'] );
		self::assertSavable( $schema );
	}

	public function test_mail_tags_become_merge_tags_and_the_sent_message_the_confirmation(): void {
		$mapped = Cf7Mapper::map( self::fixture( 'cf7-contact.json' ), self::CONTEXT );
		$schema = $mapped['schema'];
		$this->assertCount( 1, $schema['actions'], 'Mail (2) is off in this form, so only Mail comes across.' );
		$mail = $schema['actions'][0];
		$this->assertSame( 'email', $mail['type'] );
		$this->assertTrue( $mail['enabled'] );
		$this->assertSame( '{admin_email}', $mail['settings']['to'] );
		$this->assertSame( '{site_name} "{field:your-subject}"', $mail['settings']['subject'] );
		$this->assertStringContainsString( 'From: {field:your-name} {field:your-email}', $mail['settings']['message'] );
		$this->assertStringContainsString( '{site_name} https://demo.test/', $mail['settings']['message'] );
		$this->assertSame( 'text', $mail['settings']['format'] );
		// The sender is written out: headers are sent as typed.
		$this->assertSame( array( 'From: Demo Site <wordpress@example.com>' ), $mail['settings']['headers'] );
		$this->assertSame( 'Thank you for your message. It has been sent.', $schema['metadata']['confirmation']['message'] );
		$this->assertSame( 'message', $schema['metadata']['confirmation']['type'] );
		$this->assertSame( 'Please fill out this field.', $schema['metadata']['requiredMessage'] );
		// Reply-To from an answer comes across (2.6.0).
		$this->assertSame( '{field:your-email}', $mail['settings']['replyTo'] );
		$this->assertStringNotContainsString( 'Reply-To', self::report( $mapped['notes'] ) );
	}

	public function test_every_common_tag_keeps_its_settings(): void {
		$mapped = Cf7Mapper::map( self::fixture( 'cf7-visit.json' ), self::CONTEXT );
		$schema = $mapped['schema'];
		$f      = self::byKey( $schema['fields'] );

		$this->assertSame( 'section_break', $schema['fields'][0]['type'] );
		$this->assertSame( 'Book a visit', $schema['fields'][0]['title'] );
		$this->assertSame( 'html', $schema['fields'][1]['type'] );
		$this->assertStringContainsString( 'Tell us a little', $schema['fields'][1]['content'] );

		$this->assertSame( 'Full name', $f['full-name']['label'], 'The trailing * is not part of the label.' );
		$this->assertSame( 'Jane Smith', $f['full-name']['placeholder'] );
		$this->assertArrayNotHasKey( 'defaultValue', $f['full-name'] );
		$this->assertSame( 'url', $f['website']['type'] );
		$this->assertSame( 'https://', $f['website']['defaultValue'] );
		$this->assertSame( 'phone', $f['phone']['type'] );
		$this->assertSame( 30, $f['phone']['maxLength'] );
		$this->assertSame( array( 1, 12, 1 ), array( $f['guests']['min'], $f['guests']['max'], $f['guests']['step'] ) );
		$this->assertSame( '2', $f['guests']['defaultValue'] );
		$this->assertTrue( $f['guests']['required'] );
		$this->assertSame( array( '2026-01-01', '2026-12-31' ), array( $f['visit-date']['minDate'], $f['visit-date']['maxDate'] ) );

		$this->assertSame( 'dropdown', $f['time-of-day']['type'] );
		$this->assertSame( array( 'label' => 'Afternoon', 'value' => 'pm' ), $f['time-of-day']['options'][1] );
		$this->assertSame( 'Please choose an option', $f['time-of-day']['placeholder'] );
		$this->assertSame( 'multiple_choice', $f['interests']['type'], 'A multiple select is shown as checkboxes.' );
		$this->assertTrue( $f['interests']['allowMultiple'] );
		$this->assertSame( 'Lunch', $f['extras']['defaultValue'], 'default:2 ticks the second box.' );
		$this->assertSame( 'radio', $f['heard-about']['type'] );
		$this->assertTrue( $f['heard-about']['required'], 'Contact Form 7 radio buttons always have one ticked.' );
		$this->assertSame( 'Search', $f['heard-about']['defaultValue'] );

		$this->assertSame( array( 6, 500, 'Anything we should know?' ), array( $f['notes']['rows'], $f['notes']['maxLength'], $f['notes']['placeholder'] ) );
		$this->assertSame( 2097152, $f['floor-plan']['maxSize'] );
		$this->assertSame( 'pdf, jpg, png', $f['floor-plan']['allowedExtensions'] );
		$this->assertSame( 'hidden', $f['campaign']['type'] );
		$this->assertSame( '{get:campaign}', $f['campaign']['value'] );
		$this->assertSame( 'consent', $f['terms']['type'] );
		$this->assertTrue( $f['terms']['required'] );
		$this->assertSame( 'I agree to the visit terms.', $f['terms']['checkboxLabel'] );
		$this->assertSame( 'https://example.com/terms', $f['terms']['privacyPolicyUrl'] );
		$this->assertArrayNotHasKey( 'human', $f, 'The quiz is not imported.' );
		$this->assertSame( 'Request a visit', $schema['metadata']['submitText'] );
		$this->assertTrue( $schema['metadata']['restrictions']['requireLogin'] );
		self::assertSavable( $schema );
	}

	public function test_both_mails_unsupported_tags_and_settings_are_reported(): void {
		$mapped = Cf7Mapper::map( self::fixture( 'cf7-visit.json' ), self::CONTEXT );
		$schema = $mapped['schema'];
		$report = self::report( $mapped['notes'] );

		$this->assertCount( 2, $schema['actions'] );
		$admin = $schema['actions'][0]['settings'];
		$reply = $schema['actions'][1]['settings'];
		$this->assertSame( 'bookings@example.com', $admin['to'] );
		$this->assertSame( 'New visit request from {field:full-name}', $admin['subject'] );
		$this->assertSame( 'html', $admin['format'] );
		$this->assertContains( 'Cc: manager@example.com', $admin['headers'] );
		$this->assertStringContainsString( 'on {date} at', $admin['message'] );
		$this->assertSame( '{field:email-address}', $reply['to'] );
		$this->assertSame( '{field:email-address}', $admin['replyTo'] );
		$this->assertSame( 'admin@demo.test', $reply['replyTo'] );
		$this->assertNotContains( 'Reply-To: admin@demo.test', $reply['headers'] );
		$this->assertTrue( $schema['actions'][1]['enabled'] );

		$this->assertStringContainsString( "Contact Form 7 field 'What is 2 plus 3?' (type quiz) was skipped: quizzes", $report );
		$this->assertStringContainsString( 'The file attachments of the email \'Mail\' were not copied.', $report );
		$this->assertStringContainsString( '[_remote_ip] has no SubtleForms equivalent', $report );
		$this->assertStringContainsString( '[human] points at a field that was not imported', $report );
		$this->assertStringContainsString( "The additional setting 'on_sent_ok' was not copied.", $report );
		$this->assertStringContainsString( 'allowed several choices in a list', $report );
		$this->assertSame( 7, $mapped['notes']->count(), 'Lines that need attention, without the plain facts.' );
	}

	public function test_skip_mail_imports_the_emails_switched_off(): void {
		$raw                        = self::fixture( 'cf7-contact.json' );
		$raw['additional_settings'] = "skip_mail: on\n";
		$raw['mail_2']['active']    = true;
		$mapped                     = Cf7Mapper::map( $raw, self::CONTEXT );
		$this->assertCount( 2, $mapped['schema']['actions'] );
		foreach ( $mapped['schema']['actions'] as $action ) {
			$this->assertFalse( $action['enabled'] );
		}
		$this->assertStringContainsString( 'skip_mail on', self::report( $mapped['notes'] ) );
	}

	public function test_tags_without_labels_get_one_and_odd_options_are_reported(): void {
		$mapped = Cf7Mapper::map(
			array(
				'title' => 'Bare',
				'form'  => '[text your-company-name] [checkbox* topics exclusive free_text "A" "B"] [select size first_as_label "Pick one" "S" "M"] [file cv filetypes:audio/*|pdf limit:500kb] [captchar captcha-1] [text promo default:post_meta]',
			),
			self::CONTEXT
		);
		$f      = self::byKey( $mapped['schema']['fields'] );
		$report = self::report( $mapped['notes'] );
		$this->assertSame( 'Company name', $f['your-company-name']['label'] );
		$this->assertSame( 'radio', $f['topics']['type'], 'An exclusive checkbox is radio buttons.' );
		$this->assertSame( 'Pick one', $f['size']['placeholder'] );
		$this->assertCount( 2, $f['size']['options'] );
		$this->assertSame( 512000, $f['cv']['maxSize'] );
		$this->assertSame( 'pdf', $f['cv']['allowedExtensions'] );
		$this->assertStringContainsString( 'free text box', $report );
		$this->assertStringContainsString( 'The file type audio/*', $report );
		$this->assertStringContainsString( "(type captchar) was skipped: SubtleForms has its own spam protection", $report );
		$this->assertStringContainsString( 'The default default:post_meta', $report );
		self::assertSavable( $mapped['schema'] );
	}

	public function test_bytes_reads_contact_form_7_sizes(): void {
		$this->assertSame( 1048576, Cf7Mapper::bytes( '1mb' ) );
		$this->assertSame( 2048, Cf7Mapper::bytes( '2KB' ) );
		$this->assertSame( 300, Cf7Mapper::bytes( '300' ) );
		$this->assertSame( 0, Cf7Mapper::bytes( 'big' ) );
	}
}
