<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * Exporting the entries of all forms uses field labels as headings (issue 125).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Api\SubmissionsApi;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class CsvAllFormsHeadings292Test extends TestCase {

	/** An all-forms export reads every entry on the site, so start and end with none. */
	private function clearEntries(): void {
		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}subtleforms_submissions" );
	}

	protected function setUp(): void {
		parent::setUp();
		$this->clearEntries();
	}

	protected function tearDown(): void {
		$this->clearEntries();
		parent::tearDown();
	}

	private function api(): SubmissionsApi {
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		return new SubmissionsApi( new FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
	}

	private function entry( int $formId, array $payload, string $at ): void {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'subtleforms_submissions',
			array(
				'form_id'    => $formId,
				'payload'    => wp_json_encode( $payload ),
				'status'     => 'completed',
				'created_at' => $at,
			)
		);
	}

	/** @return array<int,array<int,string>> */
	private function rows( int $formId ): array {
		$h = fopen( 'php://temp', 'r+' );
		$this->api()->streamCsv( $formId, array(), $h );
		rewind( $h );
		fread( $h, 3 );
		$rows = array();
		while ( false !== ( $row = fgetcsv( $h, 0, ',', '"', '' ) ) ) {
			$rows[] = $row;
		}
		fclose( $h );
		return $rows;
	}

	private function formA(): int {
		return $this->publish(
			array(
				array( 'id' => 'a1', 'key' => 'dropdown_56deddb2', 'type' => 'select', 'label' => 'What is it about?', 'options' => array( array( 'label' => 'Sales', 'value' => 'sales' ) ) ),
				array( 'id' => 'a2', 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
			)
		);
	}

	private function formB(): int {
		return $this->publish(
			array(
				array( 'id' => 'b1', 'key' => 'dropdown_9c1f0a77', 'type' => 'select', 'label' => 'Topic', 'options' => array( array( 'label' => 'Help', 'value' => 'help' ) ) ),
				array( 'id' => 'b2', 'key' => 'email', 'type' => 'email', 'label' => 'Work email' ),
			)
		);
	}

	public function test_export_of_all_forms_uses_field_labels_as_headings(): void {
		$a = $this->formA();
		$b = $this->formB();
		$this->entry( $a, array( 'dropdown_56deddb2' => 'sales', 'email' => 'a@example.test' ), '2026-01-02 10:00:00' );
		$this->entry( $b, array( 'dropdown_9c1f0a77' => 'help', 'email' => 'b@example.test' ), '2026-01-01 10:00:00' );

		$rows    = $this->rows( 0 );
		$headers = array_slice( $rows[0], 4 );
		$this->assertSame( array( 'What is it about?', 'Email / Work email', 'Topic' ), $headers );
		foreach ( $headers as $heading ) {
			$this->assertStringNotContainsString( 'Dropdown', $heading, 'no heading is a prettified key' );
		}
		$this->assertCount( 3, $rows, 'a heading and two entries' );
	}

	public function test_single_form_export_is_unchanged(): void {
		$a = $this->formA();
		$this->entry( $a, array( 'dropdown_56deddb2' => 'sales', 'email' => 'a@example.test', 'old_key' => 'x' ), '2026-01-01 10:00:00' );

		$rows = $this->rows( $a );
		$this->assertSame( array( 'ID', 'Form ID', 'Status', 'Submitted At', 'What is it about?', 'Email', 'Old Key' ), $rows[0] );
		$this->assertSame( array( 'Sales', 'a@example.test', 'x' ), array_slice( $rows[1], 4 ) );
	}

	public function test_a_repeater_in_one_of_two_forms_keeps_one_column_per_child(): void {
		$a = $this->publish(
			array(
				array(
					'id'       => 'rep',
					'key'      => 'companies',
					'type'     => 'repeat_container',
					'label'    => 'Companies',
					'min'      => 1,
					'max'      => 3,
					'children' => array(
						array( 'id' => 'tk', 'key' => 'ticker', 'type' => 'text', 'label' => 'Ticker' ),
						array( 'id' => 'sh', 'key' => 'shares', 'type' => 'number', 'label' => 'Shares' ),
					),
				),
			)
		);
		$b = $this->formB();
		$this->entry( $a, array( 'companies' => array( array( 'ticker' => 'ENGRO', 'shares' => '10' ) ) ), '2026-01-02 10:00:00' );
		$this->entry( $b, array( 'dropdown_9c1f0a77' => 'help' ), '2026-01-01 10:00:00' );

		$rows = $this->rows( 0 );
		$this->assertSame( array( 'Companies: Ticker', 'Companies: Shares', 'Topic' ), array_slice( $rows[0], 4 ) );
		$this->assertSame( array( 'ENGRO', '10', '' ), array_slice( $rows[1], 4 ) );
	}

	public function test_a_form_that_no_longer_exists_falls_back_to_the_prettified_key(): void {
		$a = $this->formA();
		$this->entry( $a, array( 'dropdown_56deddb2' => 'sales' ), '2026-01-02 10:00:00' );
		$this->entry( 9999991, array( 'gone_field' => 'x' ), '2026-01-01 10:00:00' );

		$this->assertSame( array( 'What is it about?', 'Gone Field' ), array_slice( $this->rows( 0 )[0], 4 ) );
	}

	public function test_a_repeater_key_shared_by_two_forms_keeps_the_children_of_both(): void {
		$repeater = static fn( array $children ): array => array(
			array( 'id' => 'rep', 'key' => 'companies', 'type' => 'repeat_container', 'label' => 'Companies', 'min' => 1, 'max' => 3, 'children' => $children ),
		);
		$a = $this->publish( $repeater( array( array( 'id' => 'tk', 'key' => 'ticker', 'type' => 'text', 'label' => 'Ticker' ) ) ) );
		$b = $this->publish( $repeater( array( array( 'id' => 'sh', 'key' => 'shares', 'type' => 'number', 'label' => 'Shares' ) ) ) );
		$this->entry( $a, array( 'companies' => array( array( 'ticker' => 'ENGRO' ) ) ), '2026-01-02 10:00:00' );
		$this->entry( $b, array( 'companies' => array( array( 'shares' => '25' ) ) ), '2026-01-01 10:00:00' );

		$rows = $this->rows( 0 );
		$this->assertSame( array( 'Companies: Ticker', 'Companies: Shares' ), array_slice( $rows[0], 4 ) );
		$this->assertSame( array( 'ENGRO', '' ), array_slice( $rows[1], 4 ) );
		$this->assertSame( array( '', '25' ), array_slice( $rows[2], 4 ) );
	}
}
