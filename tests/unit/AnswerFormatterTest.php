<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * One answer formatter for the entry screen, emails, CSV, PDF data and
 * integrations (2.4.0).
 *
 * @package SubtleForms\Tests
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\AnswerFormatter;
use SubtleForms\Support\EntryValues;
use SubtleForms\Support\FieldMapper;

/**
 * @covers \SubtleForms\Support\AnswerFormatter
 */
class AnswerFormatterTest extends TestCase {

	private function choices(): array {
		return array(
			'fields' => array(
				array(
					'type'    => 'dropdown',
					'key'     => 'plan',
					'label'   => 'Plan',
					'options' => array(
						array( 'label' => 'Alpha', 'value' => 'a' ),
						array( 'label' => 'Beta', 'value' => 'b' ),
					),
				),
				array(
					'type'   => 'checkbox',
					'key'    => 'extras',
					'config' => array(
						'label'   => 'Extras',
						'options' => array(
							array( 'label' => 'One', 'value' => 'o1' ),
							array( 'label' => 'Two', 'value' => 'o2' ),
						),
					),
				),
				array(
					'type'    => 'picture_choice',
					'key'     => 'pic',
					'label'   => 'Picture',
					'options' => array( array( 'label' => 'Picture A', 'value' => 'pa', 'image' => 'a.png' ) ),
				),
				array( 'type' => 'checkbox', 'key' => 'agree', 'label' => 'Single checkbox' ),
				array(
					'type'    => 'select',
					'key'     => 'team',
					'label'   => 'Team',
					'options' => array( array( 'label' => 'Sales', 'value' => 'sales' ) ),
				),
			),
		);
	}

	private function answersByKey( array $schema, array $payload ): array {
		$out = array();
		foreach ( FieldMapper::answers( $schema, $payload ) as $row ) {
			$out[ $row['key'] ] = $row['value'];
		}
		return $out;
	}

	/** FB-13: choice labels and one Yes/No in the email text and the PDF data. */
	public function test_fb13_choice_labels_and_yes_no_everywhere() {
		$schema  = $this->choices();
		$payload = array( 'plan' => 'b', 'extras' => array( 'o1', 'o2' ), 'pic' => 'pa', 'agree' => '1' );
		$fields  = array();
		foreach ( FieldMapper::fields( $schema ) as $f ) {
			$fields[ $f['key'] ] = $f['field'];
		}

		// Email text.
		$this->assertSame( 'Beta', EntryValues::toText( 'b', $fields['plan'] ) );
		$this->assertSame( 'One, Two', EntryValues::toText( array( 'o1', 'o2' ), $fields['extras'] ) );
		$this->assertSame( 'Picture A', EntryValues::toText( 'pa', $fields['pic'] ) );
		$this->assertSame( 'Yes', EntryValues::toText( '1', $fields['agree'] ) );
		$this->assertSame( 'No', EntryValues::toText( false, $fields['agree'] ) );

		// PDF and integration data.
		$this->assertSame(
			array( 'plan' => 'Beta', 'extras' => 'One, Two', 'pic' => 'Picture A', 'agree' => 'Yes' ),
			$this->answersByKey( $schema, $payload )
		);

		// Entry screen.
		$display = AnswerFormatter::display( $schema, $payload );
		$this->assertSame( 'Beta', $display['plan']['text'] );
		$this->assertSame( array( 'One', 'Two' ), $display['extras']['items'] );
		$this->assertSame( 'Yes', $display['agree']['text'] );
	}

	/** FF-25: a select answer reads as its label in emails and the entry. */
	public function test_ff25_select_label_in_email_and_entry() {
		$schema = $this->choices();
		$field  = FieldMapper::fields( $schema )[4]['field'];
		$this->assertSame( 'Sales', EntryValues::toText( 'sales', $field ) );
		$this->assertSame( 'Sales', EntryValues::toHtml( 'sales', $field ) );
		$this->assertSame( 'Sales', AnswerFormatter::display( $schema, array( 'team' => 'sales' ) )['team']['text'] );
	}

	/** PRO-23: a ticked single checkbox reads Yes in the PDF data. */
	public function test_pro23_single_checkbox_reads_yes_in_pdf_data() {
		$schema = array( 'fields' => array( array( 'type' => 'checkbox', 'key' => 'ok', 'label' => 'OK?' ) ) );
		$this->assertSame( array( 'ok' => 'Yes' ), $this->answersByKey( $schema, array( 'ok' => '1' ) ) );
		$this->assertSame( array( 'ok' => 'Yes' ), $this->answersByKey( $schema, array( 'ok' => true ) ) );
		$this->assertSame( array( 'ok' => 'Yes' ), $this->answersByKey( $schema, array( 'ok' => 1 ) ) );
	}

	/** PAY-23: payment options read as labels, products as lines with prices. */
	public function test_pay23_payment_labels_and_product_lines() {
		$schema  = array(
			'metadata' => array( 'payment' => array( 'currency' => 'usd' ) ),
			'fields'   => array(
				array(
					'type'    => 'payment_choice',
					'key'     => 'tier',
					'label'   => 'Tier',
					'options' => array(
						array( 'label' => 'Basic', 'value' => 'basic', 'price' => 19 ),
						array( 'label' => 'Standard', 'value' => 'standard', 'price' => 49 ),
					),
				),
				array(
					'type'   => 'payment_product',
					'key'    => 'sticker',
					'config' => array(
						'label'         => 'Sticker pack',
						'productName'   => 'Sticker',
						'price'         => 5,
						'allowQuantity' => true,
					),
				),
			),
		);
		$this->assertSame(
			array( 'tier' => 'Standard ($49.00)', 'sticker' => "Sticker \u{00D7} 2 (\$10.00)" ),
			$this->answersByKey( $schema, array( 'tier' => 'standard', 'sticker' => '2' ) )
		);
	}

	/** FA-10: matrix answers name their rows and columns. */
	public function test_fa10_matrix_names_rows_and_columns() {
		$single = array(
			'type'           => 'checkbox_grid',
			'key'            => 'rate',
			'label'          => 'Rate us',
			'multiplePerRow' => false,
			'rows'           => array( 'Speed', 'Price' ),
			'columns'        => array( 'Poor', 'OK', 'Good' ),
		);
		$this->assertSame( 'Speed: Good; Price: OK', AnswerFormatter::text( array( 'Speed' => 'Good', 'Price' => 'OK' ), $single ) );

		$multi = array(
			'type'    => 'checkbox_grid',
			'key'     => 'slots',
			'rows'    => array( array( 'label' => 'Monday', 'value' => 'Mon' ) ),
			'columns' => array( array( 'label' => 'AM', 'value' => 'am' ), array( 'label' => 'PM', 'value' => 'pm' ) ),
		);
		$this->assertSame( 'Monday: AM, PM', AnswerFormatter::text( array( 'Mon' => array( 'am' => true, 'pm' => true ) ), $multi ) );
		$this->assertSame( 'Monday: PM', AnswerFormatter::text( array( 'Mon' => array( 'am' => false, 'pm' => true ) ), $multi ) );

		$schema = array( 'fields' => array( $single ) );
		$this->assertSame( array( 'rate' => 'Speed: Good; Price: OK' ), $this->answersByKey( $schema, array( 'rate' => array( 'Speed' => 'Good', 'Price' => 'OK' ) ) ) );
		$this->assertSame( 'Speed: Good; Price: OK', EntryValues::toText( array( 'Speed' => 'Good', 'Price' => 'OK' ), $single ) );
	}

	/** FA-11: dates and times follow the field display format. */
	public function test_fa11_dates_follow_the_field_format() {
		$this->assertSame( '15/06/2026', AnswerFormatter::text( '2026-06-15', array( 'type' => 'date', 'format' => 'd/m/Y' ) ) );
		$this->assertSame( '9:30 AM', AnswerFormatter::text( '09:30', array( 'type' => 'time', 'config' => array( 'format' => 'g:i A' ) ) ) );
		$this->assertSame( '15/06/2026 14:30', AnswerFormatter::text( '2026-06-15T14:30', array( 'type' => 'datetime', 'format' => 'd/m/Y H:i' ) ) );
		// Defaults, and values that are not ISO dates, are kept as they are.
		$this->assertSame( '2026-06-15 14:30', AnswerFormatter::text( '2026-06-15T14:30', array( 'type' => 'datetime' ) ) );
		$this->assertSame( 'next week', AnswerFormatter::text( 'next week', array( 'type' => 'date', 'format' => 'd/m/Y' ) ) );

		$schema = array( 'fields' => array( array( 'type' => 'date', 'key' => 'day', 'label' => 'Day', 'format' => 'd/m/Y' ) ) );
		$this->assertSame( array( 'day' => '15/06/2026' ), $this->answersByKey( $schema, array( 'day' => '2026-06-15' ) ) );
	}

	/** PRO2-08: chained select answers read as the label of each level. */
	public function test_pro208_chained_select_labels() {
		$chained = array(
			'type'   => 'chained_select',
			'key'    => 'place',
			'label'  => 'Place',
			'levels' => array(
				array( 'label' => 'Country', 'options' => array( array( 'label' => 'Pakistan', 'value' => 'pakistan' ) ) ),
				array( 'label' => 'Province', 'options' => array( array( 'label' => 'Punjab', 'value' => 'punjab', 'parent' => 'pakistan' ) ) ),
			),
		);
		$schema  = array( 'fields' => array( $chained, array( 'type' => 'email', 'key' => 'email', 'label' => 'Email' ) ) );
		$payload = array( 'place' => array( 'pakistan', 'punjab' ), 'email' => 'a@example.com' );

		// PDF, HubSpot note, webhooks.
		$this->assertSame( 'Pakistan, Punjab', $this->answersByKey( $schema, $payload )['place'] );
		// Email.
		$this->assertSame( 'Pakistan, Punjab', EntryValues::toText( $payload['place'], $chained ) );
		// Mailchimp merge fields and HubSpot properties.
		$this->assertSame( 'Pakistan, Punjab', FieldMapper::value( $payload, 'place', $schema ) );
		$this->assertSame( array( 'PLACE' => 'Pakistan, Punjab' ), FieldMapper::mapRows( $payload, array( array( 'field' => 'place', 'target' => 'PLACE' ) ), 'target', $schema ) );

		// A tree of options with children.
		$tree = array(
			'type'    => 'chained_select',
			'options' => array(
				array( 'label' => 'Pakistan', 'value' => 'pk', 'children' => array( array( 'label' => 'Sindh', 'value' => 'sd' ) ) ),
			),
		);
		$this->assertSame( 'Pakistan, Sindh', AnswerFormatter::text( array( 'pk', 'sd' ), $tree ) );
	}
}
