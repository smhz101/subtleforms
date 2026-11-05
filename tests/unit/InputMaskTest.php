<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Input mask (2.8.0): presets, the setting's declaration and save contract,
 * and the server check for every preset and for custom masks.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;
use SubtleForms\Fields\InputMask;
use SubtleForms\Frontend\FrontendAssets;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;
use SubtleForms\Validation\ValidationException;

final class InputMaskTest extends TestCase {

	private function errors( array $field, $value, string $type = 'text' ): array {
		$field  = array_merge( array( 'key' => 'f', 'type' => $type ), $field );
		$schema = array( 'fields' => array( $field ) );
		$payload = FieldValidator::prepare( $schema, array( 'f' => $value ) );
		$result  = ( new FieldValidator() )->validate( $schema, $payload, array( 'hidden_fields' => array(), 'required_fields' => array() ) );
		return $result['errors'];
	}

	private function stored( array $field, $value, string $type = 'text' ) {
		$field = array_merge( array( 'key' => 'f', 'type' => $type ), $field );
		return FieldValidator::prepare( array( 'fields' => array( $field ) ), array( 'f' => $value ) )['f'];
	}

	private function error( array $field, $value, string $type = 'text' ): ?string {
		return $this->errors( $field, $value, $type )['f'] ?? null;
	}

	/** The PHP presets and the browser presets are the same. */
	public function test_presets_match_the_browser(): void {
		$js = (string) file_get_contents( dirname( __DIR__, 2 ) . '/resources/shared/inputMask.js' );
		$this->assertSame( 1, preg_match( '/PRESETS_START \*\/(.*?)\/\* PRESETS_END/s', $js, $block ) );
		preg_match_all( "/^  (\w+): \{ patterns: \[(.*?)\], kind: '(\w+)'(?:, order: '(\w+)')?, example: '(.*?)' \}/m", $block[1], $rows, PREG_SET_ORDER );
		$browser = array();
		foreach ( $rows as $row ) {
			preg_match_all( "/'([^']+)'/", $row[2], $patterns );
			$entry = array( 'patterns' => $patterns[1], 'kind' => $row[3] );
			if ( '' !== $row[4] ) {
				$entry['order'] = $row[4];
			}
			$entry['example']  = $row[5];
			$browser[ $row[1] ] = $entry;
		}
		$this->assertSame( InputMask::presets(), $browser );
	}

	public function test_settings_are_declared_for_text_number_and_phone_on_the_validation_tab(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		FieldSettings::decorateAll( $registry );
		foreach ( array( 'text', 'number', 'phone' ) as $type ) {
			$controls = array_column( $registry->get( $type )->inspectorControls, null, 'name' );
			foreach ( array( 'inputMask', 'maskPattern', 'maskTry', 'maskStore' ) as $name ) {
				$this->assertSame( 'validation', $controls[ $name ]['section'], "$type $name" );
			}
			$this->assertSame( 'Input mask', $controls['inputMask']['label'] );
			$this->assertSame( array( 'custom' ), $controls['maskPattern']['showWhen']['inputMask'] );
			$this->assertSame( 'Pattern', $controls['maskPattern']['label'] );
			$this->assertSame(
				'9 is a digit, A is a letter, * is a letter or digit. Anything else is typed for the visitor, for example AA-9999.',
				$controls['maskPattern']['help']
			);
			$this->assertSame( 'Try it', $controls['maskTry']['label'] );
			// Dates and times stay as typed, so they do not offer Save as.
			$this->assertSame( array( 'phone', 'zip_us', 'custom' ), $controls['maskStore']['showWhen']['inputMask'] );
		}
		$text = array_column( $registry->get( 'text' )->inspectorControls, null, 'name' );
		$this->assertSame(
			array( '', 'phone', 'date_dmy', 'date_mdy', 'date_ymd', 'time_24', 'zip_us', 'custom' ),
			array_column( $text['inputMask']['options'], 'value' )
		);
		$phone = array_column( $registry->get( 'phone' )->inspectorControls, null, 'name' );
		$this->assertSame( array( '', 'phone' ), array_column( $phone['inputMask']['options'], 'value' ) );
		$labels = array_column( $text['inputMask']['options'], 'label' );
		$this->assertNotContains( 'Credit card', $labels );
		$this->assertSame( 'None', $labels[0] );
		$other = array_column( $registry->get( 'email' )->inspectorControls, null, 'name' );
		$this->assertArrayNotHasKey( 'inputMask', $other );
	}

	private function saved( array $field ): array {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		$out       = $validator->validateOrFail(
			array( 'activate' => true, 'schema' => array( 'fields' => array( $field ) ) ),
			Schemas::get( Schemas::FORM_SCHEMA_SAVE )
		);
		return $out['schema']['fields'][0];
	}

	public function test_save_accepts_known_masks_and_rejects_unknown_ones(): void {
		foreach ( InputMask::keys() as $key ) {
			$this->assertSame( $key, $this->saved( array( 'type' => 'text', 'key' => 't', 'inputMask' => $key ) )['inputMask'] ?? '' );
		}
		foreach ( array( 'credit_card', 'DATE_DMY', '9999' ) as $bad ) {
			try {
				$this->saved( array( 'type' => 'text', 'key' => 't', 'inputMask' => $bad ) );
				$this->fail( "Accepted $bad" );
			} catch ( ValidationException $e ) {
				$this->assertArrayHasKey( 'schema.fields[0].inputMask', $e->getFields() );
			}
		}
		try {
			$this->saved( array( 'type' => 'text', 'key' => 't', 'maskStore' => 'everything' ) );
			$this->fail( 'Accepted maskStore' );
		} catch ( ValidationException $e ) {
			$this->assertTrue( true );
		}
	}

	public function test_sanitize_settings_drops_unknown_values_and_trims_the_pattern(): void {
		$this->assertSame( '', InputMask::sanitizeSettings( array( 'inputMask' => 'card' ) )['inputMask'] );
		$this->assertSame( '', InputMask::sanitizeSettings( array( 'inputMask' => array( 'x' ) ) )['inputMask'] );
		$this->assertSame( 'zip_us', InputMask::sanitizeSettings( array( 'inputMask' => 'zip_us' ) )['inputMask'] );
		$this->assertSame( 'typed', InputMask::sanitizeSettings( array( 'maskStore' => 'x' ) )['maskStore'] );
		$this->assertSame( 'digits', InputMask::sanitizeSettings( array( 'maskStore' => 'digits' ) )['maskStore'] );
		$long = InputMask::sanitizeSettings( array( 'maskPattern' => str_repeat( '9', 200 ) ) )['maskPattern'];
		$this->assertSame( 64, strlen( $long ) );
		$this->assertSame( 'AA-9999', InputMask::sanitizeSettings( array( 'maskPattern' => '<b>AA-9999' ) )['maskPattern'] );
		// Untouched when absent.
		$this->assertSame( array( 'type' => 'text' ), InputMask::sanitizeSettings( array( 'type' => 'text' ) ) );
	}

	public function test_no_mask_changes_nothing(): void {
		$this->assertNull( $this->error( array(), 'anything at all' ) );
		$this->assertNull( $this->error( array( 'inputMask' => '' ), 'anything at all' ) );
		$this->assertNull( $this->error( array( 'inputMask' => 'bogus' ), 'anything at all' ) );
		$this->assertNull( $this->error( array( 'inputMask' => 'custom', 'maskPattern' => '' ), 'anything' ) );
	}

	public function test_an_empty_optional_field_passes_and_a_required_one_does_not(): void {
		$this->assertNull( $this->error( array( 'inputMask' => 'date_dmy' ), '' ) );
		$this->assertNotNull( $this->error( array( 'inputMask' => 'date_dmy', 'required' => true ), '' ) );
	}

	/** @dataProvider dates */
	public function test_dates( string $preset, string $value, ?string $message ): void {
		$this->assertSame( $message, $this->error( array( 'inputMask' => $preset ), $value ) );
	}

	public function dates(): array {
		return array(
			'dmy ok'          => array( 'date_dmy', '31/12/2026', null ),
			'dmy leap'        => array( 'date_dmy', '29/02/2024', null ),
			'dmy not leap'    => array( 'date_dmy', '29/02/2025', 'That date does not exist. Enter the date as DD/MM/YYYY.' ),
			'dmy 31 feb'      => array( 'date_dmy', '31/02/2026', 'That date does not exist. Enter the date as DD/MM/YYYY.' ),
			'dmy short year'  => array( 'date_dmy', '31/12/26', 'Enter the date as DD/MM/YYYY.' ),
			'dmy wrong sep'   => array( 'date_dmy', '31-12-2026', 'Enter the date as DD/MM/YYYY.' ),
			'dmy letters'     => array( 'date_dmy', 'aa/bb/cccc', 'Enter the date as DD/MM/YYYY.' ),
			'dmy month 13'    => array( 'date_dmy', '01/13/2026', 'That date does not exist. Enter the date as DD/MM/YYYY.' ),
			'mdy ok'          => array( 'date_mdy', '12/31/2026', null ),
			'mdy 31 apr'      => array( 'date_mdy', '04/31/2026', 'That date does not exist. Enter the date as MM/DD/YYYY.' ),
			'ymd ok'          => array( 'date_ymd', '2026-12-31', null ),
			'ymd bad'         => array( 'date_ymd', '2026-02-30', 'That date does not exist. Enter the date as YYYY-MM-DD.' ),
			'ymd format'      => array( 'date_ymd', '31/12/2026', 'Enter the date as YYYY-MM-DD.' ),
			'year zero'       => array( 'date_ymd', '0000-01-01', 'That date does not exist. Enter the date as YYYY-MM-DD.' ),
		);
	}

	/** @dataProvider times */
	public function test_times( string $value, ?string $message ): void {
		$this->assertSame( $message, $this->error( array( 'inputMask' => 'time_24' ), $value ) );
	}

	public function times(): array {
		$bad = 'Enter the time as HH:MM (24-hour).';
		return array(
			array( '00:00', null ),
			array( '23:59', null ),
			array( '24:00', $bad ),
			array( '12:60', $bad ),
			array( '1:30', $bad ),
			array( '12.30', $bad ),
		);
	}

	/** @dataProvider zips */
	public function test_zip( string $value, bool $ok ): void {
		$error = $this->error( array( 'inputMask' => 'zip_us' ), $value );
		$this->assertSame( $ok ? null : 'Enter a US ZIP code, such as 12345 or 12345-6789.', $error );
	}

	public function zips(): array {
		return array(
			array( '12345', true ),
			array( '12345-6789', true ),
			array( '1234', false ),
			array( '123456', false ),
			array( '12345-678', false ),
			array( '12345 6789', false ),
			array( 'ABCDE', false ),
		);
	}

	public function test_custom_masks(): void {
		$field = array( 'inputMask' => 'custom', 'maskPattern' => 'AA-9999' );
		$this->assertNull( $this->error( $field, 'ab-1234' ) );
		$this->assertNull( $this->error( $field, 'éa-1234' ) );
		$expected = 'Enter this in the format AA-9999.';
		$this->assertSame( $expected, $this->error( $field, 'a1-1234' ) );
		$this->assertSame( $expected, $this->error( $field, 'ab1234' ) );
		$this->assertSame( $expected, $this->error( $field, 'ab-123' ) );
		$this->assertSame( $expected, $this->error( $field, 'ab-12345' ) );

		$either = array( 'inputMask' => 'custom', 'maskPattern' => '**-**' );
		$this->assertNull( $this->error( $either, 'a1-2b' ) );
		$this->assertNotNull( $this->error( $either, 'a1_2b' ) );
	}

	public function test_a_setting_inside_config_counts(): void {
		$this->assertNotNull( $this->error( array( 'config' => array( 'inputMask' => 'zip_us' ) ), 'nope' ) );
		$this->assertNull( $this->error( array( 'config' => array( 'inputMask' => 'zip_us' ) ), '12345' ) );
	}

	public function test_digits_only_storage_strips_the_literals_and_checks_the_digits(): void {
		$field = array( 'inputMask' => 'custom', 'maskPattern' => '999-99', 'maskStore' => 'digits' );
		// The browser sends digits; a plain post sends what was typed.
		$this->assertSame( '12345', $this->stored( $field, '12345' ) );
		$this->assertSame( '12345', $this->stored( $field, '123-45' ) );
		$this->assertNull( $this->error( $field, '12345' ) );
		$this->assertNull( $this->error( $field, '123-45' ) );
		$this->assertNotNull( $this->error( $field, '1234' ) );
		$this->assertNotNull( $this->error( $field, '123456' ) );
		$this->assertNotNull( $this->error( $field, '12a45' ) );
		// Typed storage keeps the dash and wants it.
		$typed = array( 'inputMask' => 'custom', 'maskPattern' => '999-99' );
		$this->assertSame( '123-45', $this->stored( $typed, '123-45' ) );
		$this->assertNotNull( $this->error( $typed, '12345' ) );
	}

	public function test_zip_digits_only_takes_five_or_nine_digits(): void {
		$field = array( 'inputMask' => 'zip_us', 'maskStore' => 'digits' );
		$this->assertSame( '123456789', $this->stored( $field, '12345-6789' ) );
		$this->assertNull( $this->error( $field, '12345-6789' ) );
		$this->assertNull( $this->error( $field, '12345' ) );
		$this->assertNotNull( $this->error( $field, '1234567' ) );
	}

	public function test_dates_and_times_stay_as_typed_whatever_the_storage_says(): void {
		$field = array( 'inputMask' => 'date_dmy', 'maskStore' => 'digits' );
		$this->assertSame( '31/12/2026', $this->stored( $field, '31/12/2026' ) );
		$this->assertNull( $this->error( $field, '31/12/2026' ) );
		$this->assertNotNull( $this->error( $field, '31122026' ) );
	}

	public function test_phone_mask_is_generic_and_bounded(): void {
		$field = array( 'inputMask' => 'phone' );
		foreach ( array( '(555) 010-1234', '+44 20 7946 0958', '555-0101' ) as $ok ) {
			$this->assertNull( $this->error( $field, $ok, 'phone' ), $ok );
		}
		foreach ( array( 'call me', '123', '1234567890123456', '555 010 12x4', '12+34', '555.010.1234' ) as $bad ) {
			$this->assertSame( 'Invalid phone number.', $this->error( $field, $bad, 'phone' ), $bad );
		}
		// A text field takes the phone mask too.
		$this->assertNull( $this->error( $field, '(555) 010-1234', 'text' ) );
		$this->assertNotNull( $this->error( $field, 'abc', 'text' ) );
	}

	public function test_phone_mask_digits_only(): void {
		$field = array( 'inputMask' => 'phone', 'maskStore' => 'digits' );
		$this->assertSame( '5550101234', $this->stored( $field, '(555) 010-1234', 'phone' ) );
		// An international number is tidied to calling code and digits first.
		$this->assertSame( '+44 2079460958', $this->stored( $field, '+44 (20) 7946-0958', 'phone' ) );
		// A calling code from the country list stays apart.
		$this->assertSame( '+44 2079460958', $this->stored( $field, '+44 20 7946 0958', 'phone' ) );
		$this->assertNull( $this->error( $field, '(555) 010-1234', 'phone' ) );
	}

	public function test_masked_number_is_checked_by_its_mask_then_its_range(): void {
		$field = array( 'inputMask' => 'custom', 'maskPattern' => '99-99' );
		$this->assertNull( $this->error( $field, '12-34', 'number' ) );
		$this->assertSame( 'Enter this in the format 99-99.', $this->error( $field, '12-3', 'number' ) );
		$digits = array( 'inputMask' => 'custom', 'maskPattern' => '99-99', 'maskStore' => 'digits', 'min' => 2000 );
		$this->assertSame( '1234', $this->stored( $digits, '12-34', 'number' ) );
		$this->assertSame( 'Must be at least 2000.', $this->error( $digits, '12-34', 'number' ) );
		$this->assertNull( $this->error( array_merge( $digits, array( 'min' => 1000 ) ), '12-34', 'number' ) );
		// Without a mask a number is still a number.
		$this->assertSame( 'Please enter a number.', $this->error( array(), '12-34', 'number' ) );
	}

	public function test_the_fields_own_validation_message_replaces_the_mask_message(): void {
		$field = array( 'inputMask' => 'date_dmy', 'validationMessage' => 'Use day/month/year.' );
		$this->assertSame( 'Use day/month/year.', $this->error( $field, '1/1' ) );
	}

	public function test_a_list_is_not_a_masked_answer(): void {
		$this->assertNotNull( $this->error( array( 'inputMask' => 'zip_us' ), array( '12345' ) ) );
	}

	public function test_mask_code_is_asked_for_only_by_forms_that_use_a_mask(): void {
		$groups = static fn( array $fields ) => FrontendAssets::fieldGroups( array( 'metadata' => array( 'type' => 'regular' ), 'fields' => $fields ) );
		$this->assertSame( array(), $groups( array( array( 'type' => 'text', 'key' => 'a' ) ) ) );
		$this->assertSame( array(), $groups( array( array( 'type' => 'text', 'key' => 'a', 'inputMask' => '' ) ) ) );
		$this->assertSame( array( 'mask' ), $groups( array( array( 'type' => 'text', 'key' => 'a', 'inputMask' => 'zip_us' ) ) ) );
		$this->assertSame( array( 'mask' ), $groups( array( array( 'type' => 'number', 'key' => 'a', 'config' => array( 'inputMask' => 'custom' ) ) ) ) );
		$this->assertSame( array( 'mask' ), $groups( array( array( 'type' => 'step', 'children' => array( array( 'type' => 'phone', 'key' => 'p', 'inputMask' => 'phone' ) ) ) ) ) );
		$this->assertSame( array( 'geo' ), $groups( array( array( 'type' => 'phone', 'key' => 'p', 'inputMask' => 'phone', 'enableCountryCode' => true ) ) ) );
		$this->assertSame( array(), $groups( array( array( 'type' => 'email', 'key' => 'e', 'inputMask' => 'phone' ) ) ) );
		$chunks = ( new \ReflectionClass( FrontendAssets::class ) )->getConstant( 'GROUP_CHUNKS' );
		$this->assertSame( 'field-mask', $chunks['mask'] );
		$js = (string) file_get_contents( dirname( __DIR__, 2 ) . '/resources/frontend/components/fields/lazyFields.jsx' );
		$this->assertMatchesRegularExpression( '/mask: \(\) => import\(\/\* webpackChunkName: "field-mask" \*\//', $js );
	}
}
