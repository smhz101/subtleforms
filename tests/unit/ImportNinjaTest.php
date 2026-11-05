<?php
/**
 * Ninja Forms import: fields, logic, actions, merge tags, entries, export file.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/ImportTestCase.php';

use SubtleForms\Tools\Import\NinjaExport;
use SubtleForms\Tools\Import\NinjaMapper;

/**
 * @covers \SubtleForms\Tools\Import\NinjaMapper
 * @covers \SubtleForms\Tools\Import\NinjaExport
 */
final class ImportNinjaTest extends ImportTestCase {

	/**
	 * The fixture rows folded the way NinjaSource::read() does: column values,
	 * then meta over them.
	 *
	 * @return array
	 */
	private static function form(): array {
		$rows     = self::fixture( 'ninja-contact.json' );
		$settings = array();
		foreach ( $rows['form_meta'] as $meta ) {
			$settings[ $meta['key'] ] = $meta['value'];
		}
		$fold = static function ( array $list ): array {
			$out = array();
			foreach ( $list as $row ) {
				$item       = array_diff_key( $row, array( 'meta' => 1 ) );
				$out[] = array_merge( $item, $row['meta'] );
			}
			return $out;
		};
		return array(
			'id'       => (string) $rows['form']['id'],
			'title'    => $rows['form']['title'],
			'settings' => $settings,
			'fields'   => $fold( $rows['fields'] ),
			'actions'  => $fold( $rows['actions'] ),
		);
	}

	/**
	 * @return array
	 */
	private static function mapped(): array {
		return NinjaMapper::map( self::form(), self::CONTEXT );
	}

	public function test_each_field_type_keeps_its_settings(): void {
		$mapped = self::mapped();
		$f      = self::byKey( $mapped['schema']['fields'] );

		$this->assertSame( 'text', $f['firstname']['type'] );
		$this->assertTrue( $f['firstname']['required'] );
		$this->assertSame( 'email', $f['email']['type'] );
		$this->assertSame( 'you@example.com', $f['email']['placeholder'] );
		$this->assertSame( 'Never shared.', $f['email']['description'] );
		$this->assertSame( 'dropdown', $f['topic']['type'] );
		$this->assertSame( array( 'sales', 'support' ), array_column( $f['topic']['options'], 'value' ) );
		$this->assertSame( 'textarea', $f['details']['type'] );
		$this->assertSame( 300, $f['details']['maxLength'] );
		$this->assertSame( 'multiple_choice', $f['extras']['type'] );
		$this->assertSame( 'checkbox', $f['subscribe']['type'] );
		$this->assertSame( 'date', $f['visit']['type'] );
		$this->assertSame( 'rating', $f['rating']['type'] );
		$this->assertSame( 5, $f['rating']['max'] );
		$this->assertSame( 'file_upload', $f['file']['type'] );
		$this->assertSame( 'pdf, png', $f['file']['allowedExtensions'] );
		$this->assertSame( 2097152, $f['file']['maxSize'] );
		$this->assertSame( '<p>Read this first.</p>', $f['note']['content'] );
		$this->assertSame( 'Send it', $mapped['schema']['metadata']['submitText'] );
		$this->assertArrayNotHasKey( 'submit', $f, 'The submit button is not a field.' );
		$this->assertSame( 100, $mapped['schema']['metadata']['restrictions']['entryLimit'] );
		self::assertSavable( $mapped['schema'] );
	}

	public function test_captcha_payments_and_confirm_fields_are_noted(): void {
		$mapped = self::mapped();
		$f      = self::byKey( $mapped['schema']['fields'] );
		foreach ( array( 'recaptcha', 'item', 'confirm' ) as $gone ) {
			$this->assertArrayNotHasKey( $gone, $f );
		}
		$report = self::report( $mapped['notes'] );
		$this->assertStringContainsString( "Ninja Forms field 'reCAPTCHA' (type recaptcha) was skipped: SubtleForms has its own spam protection", $report );
		$this->assertStringContainsString( "(type product) was skipped: payments are not imported.", $report );
		$this->assertStringContainsString( "(type confirm) was skipped: confirm fields are not imported.", $report );
	}

	public function test_conditional_logic_moves_onto_the_field_it_shows(): void {
		$f = self::byKey( self::mapped()['schema']['fields'] );
		$this->assertSame(
			array(
				'action' => 'show',
				'groups' => array( array( 'match' => 'all', 'rules' => array( array( 'field' => 'topic', 'operator' => 'equals', 'value' => 'support' ) ) ) ),
			),
			$f['details']['logic']
		);
	}

	public function test_an_unsupported_trigger_is_reported(): void {
		$form                                            = self::form();
		$form['fields'][3]['conditions'][0]['then'][0]['trigger'] = 'change_value';
		$mapped = NinjaMapper::map( $form, self::CONTEXT );
		$this->assertArrayNotHasKey( 'logic', self::byKey( $mapped['schema']['fields'] )['details'] );
		$this->assertStringContainsString( 'does something other than show or hide it', self::report( $mapped['notes'] ) );
	}

	public function test_email_actions_translate_merge_tags(): void {
		$mapped  = self::mapped();
		$actions = $mapped['schema']['actions'];
		$this->assertCount( 2, $actions, 'Only the two email actions.' );
		$one = $actions[0]['settings'];
		$this->assertSame( '{admin_email}', $one['to'] );
		$this->assertSame( 'New message from {field:firstname}', $one['subject'] );
		$this->assertSame( "{field:details}\n{all_fields}\nBy {field:email}", $one['message'] );
		$this->assertSame( '{field:email}', $one['replyTo'] );
		$this->assertSame( array( 'From: Demo Site <admin@demo.test>' ), $one['headers'] );
		$this->assertSame( 'html', $one['format'] );

		$two = $actions[1]['settings'];
		$this->assertSame( '{field:email}', $two['to'] );
		$this->assertSame( 'equals', $two['logic']['groups'][0]['rules'][0]['operator'] );
		$this->assertStringContainsString( 'Hi {field:firstname}, {post:id}', $two['message'] );
		$report = self::report( $mapped['notes'] );
		$this->assertStringContainsString( 'The merge tag {post:id} has no SubtleForms equivalent', $report );
		$this->assertStringContainsString( "The action 'Newsletter' (type mailchimp) was not copied.", $report );
	}

	public function test_success_message_and_redirect_become_the_confirmation(): void {
		$conf = self::mapped()['schema']['metadata']['confirmation'];
		$this->assertSame( array( 'type' => 'message', 'message' => '<p>Thank you {field:firstname}.</p>' ), $conf );

		$form              = self::form();
		$form['actions'][] = array( 'id' => 30, 'type' => 'redirect', 'label' => 'Go', 'active' => 1, 'redirect_url' => 'https://example.com/done' );
		$conf              = NinjaMapper::map( $form, self::CONTEXT )['schema']['metadata']['confirmation'];
		$this->assertSame( array( 'type' => 'redirect', 'redirectUrl' => 'https://example.com/done' ), $conf );
	}

	public function test_entries_become_answers_for_the_new_keys(): void {
		$map     = self::mapped()['entry_map'];
		$files   = 0;
		$payload = NinjaMapper::payload(
			$map,
			array(
				'1'  => 'Ada',
				'3'  => 'ada@example.com',
				'4'  => 'support',
				'6'  => array( 'Gift wrap', 'Express' ),
				'7'  => '1',
				'8'  => '15/03/2025',
				'9'  => '4',
				'10' => 'https://example.com/a.pdf',
				'5'  => '',
				'99' => 'not a field',
			),
			$files
		);
		$this->assertSame(
			array(
				'firstname'  => 'Ada',
				'email'      => 'ada@example.com',
				'topic'      => 'support',
				'extras'     => array( 'Gift wrap', 'Express' ),
				'subscribe'  => true,
				'visit'      => '2025-03-15',
				'rating'     => '4',
				'file'       => 'https://example.com/a.pdf',
			),
			$payload
		);
		$this->assertSame( 1, $files );
	}

	public function test_the_export_file_reads_in_every_common_format(): void {
		$json  = (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/import/ninja-export.nff' );
		$plain = NinjaExport::decode( $json );
		$this->assertIsArray( $plain );
		$this->assertSame( 'Ninja contact', $plain['settings']['title'] );
		$this->assertSame( $plain, NinjaExport::decode( base64_encode( $json ) ) );
		$this->assertSame( $plain, NinjaExport::decode( serialize( $plain ) ) );
		$this->assertSame( $plain, NinjaExport::decode( base64_encode( serialize( $plain ) ) ) );
		$this->assertNull( NinjaExport::decode( 'not an export' ) );
		$this->assertNull( NinjaExport::decode( '' ) );
		$this->assertNull( NinjaExport::decode( base64_encode( 'O:8:"stdClass":0:{}' ) ), 'Objects are never created.' );
	}

	public function test_an_export_file_maps_like_the_database(): void {
		$export = NinjaExport::decode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/import/ninja-export.nff' ) );
		$mapped = NinjaMapper::map( $export, self::CONTEXT );
		$this->assertSame( 'Ninja contact', $mapped['title'] );
		$f = self::byKey( $mapped['schema']['fields'] );
		$this->assertSame( 'dropdown', $f['topic']['type'] );
		$this->assertSame( 'show', $f['details']['logic']['action'] );
		$this->assertCount( 2, $mapped['schema']['actions'] );
		$this->assertSame( 'message', $mapped['schema']['metadata']['confirmation']['type'] );
	}
}
