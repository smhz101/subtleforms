<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * QA-09: Repeater groups are validated per group, conditional rules run per
 * group, and answers format as a list (text, PDF) and a table (HTML).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\ConditionalLogic;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\Repeater;

/**
 * @covers \SubtleForms\Support\Repeater
 * @covers \SubtleForms\Engine\ConditionalLogic
 * @covers \SubtleForms\Support\FieldMapper
 */
final class RepeaterTest extends TestCase {

	private function schema( array $extraChild = array() ): array {
		return array(
			'fields' => array(
				array( 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
				array(
					'key'         => 'companies',
					'type'        => 'repeat_container',
					'label'       => 'Companies',
					'min'         => 1,
					'max'         => 3,
					'buttonLabel' => 'Add another company',
					'children'    => array_merge(
						array(
							array( 'key' => 'ticker', 'type' => 'text', 'label' => 'Ticker', 'required' => true ),
							array( 'key' => 'company', 'type' => 'text', 'label' => 'Company name' ),
							array( 'key' => 'shares', 'type' => 'number', 'label' => 'Number of shares', 'min' => 1 ),
							array( 'key' => 'date', 'type' => 'date', 'label' => 'Purchase date' ),
						),
						$extraChild
					),
				),
			),
		);
	}

	private function validate( array $schema, array $payload ): array {
		$state    = ( new ConditionalLogic( '2026-10-12' ) )->evaluate( $schema, $payload );
		$expanded = Repeater::expandForValidation( $schema, $payload );
		$result   = ( new FieldValidator() )->validate( $expanded['schema'], $expanded['payload'], $state );
		$result['errors'] = array_merge( $result['errors'], Repeater::countErrors( $schema, $payload, $state['hidden_fields'] ) );
		return $result['errors'];
	}

	public function test_required_and_format_rules_apply_to_each_group(): void {
		$errors = $this->validate(
			$this->schema(),
			array(
				'companies' => array(
					array( 'ticker' => 'AAPL', 'shares' => '8' ),
					array( 'ticker' => '', 'shares' => '0' ),
					array( 'ticker' => 'MSFT', 'shares' => 'abc' ),
				),
			)
		);
		$this->assertArrayNotHasKey( 'companies.0.ticker', $errors );
		$this->assertArrayHasKey( 'companies.1.ticker', $errors );
		$this->assertArrayHasKey( 'companies.1.shares', $errors );
		$this->assertArrayHasKey( 'companies.2.shares', $errors );
		$this->assertArrayNotHasKey( 'ticker', $errors );
	}

	public function test_fewer_groups_than_the_minimum_is_one_error_on_the_repeater(): void {
		// FA-23: "Add at least 2 entries.", not errors for the fields of the
		// groups that were never sent.
		$schema                       = $this->schema();
		$schema['fields'][1]['min']   = 2;
		$errors                       = $this->validate( $schema, array( 'companies' => array( array( 'ticker' => 'AAPL' ) ) ) );
		$this->assertSame( array( 'companies' => 'Add at least 2 entries.' ), $errors );

		$errors = $this->validate( $this->schema(), array() );
		$this->assertSame( array( 'companies' => 'Add at least 1 entry.' ), $errors );
	}

	public function test_more_groups_than_the_maximum_is_an_error(): void {
		$groups = array_fill( 0, 4, array( 'ticker' => 'X' ) );
		$errors = $this->validate( $this->schema(), array( 'companies' => $groups ) );
		$this->assertArrayHasKey( 'companies', $errors );
	}

	public function test_indexed_form_post_is_read_in_order(): void {
		$groups = Repeater::groups( array( '1' => array( 'ticker' => 'B' ), '0' => array( 'ticker' => 'A' ), 'x' => 'junk' ) );
		$this->assertSame( array( array( 'ticker' => 'A' ), array( 'ticker' => 'B' ) ), $groups );
	}

	public function test_conditional_rules_run_per_group(): void {
		$schema = $this->schema(
			array(
				array(
					'key'      => 'reason',
					'type'     => 'text',
					'label'    => 'Reason',
					'required' => true,
					'logic'    => array(
						'action' => 'show',
						'groups' => array( array( 'match' => 'all', 'rules' => array( array( 'field' => 'ticker', 'operator' => 'equals', 'value' => 'OTHER' ) ) ) ),
					),
				),
			)
		);
		$payload = array(
			'companies' => array(
				array( 'ticker' => 'AAPL' ),
				array( 'ticker' => 'OTHER' ),
			),
		);
		$state = ( new ConditionalLogic( '2026-10-12' ) )->evaluate( $schema, $payload );
		$this->assertContains( 'companies.0.reason', $state['hidden_fields'] );
		$this->assertNotContains( 'companies.1.reason', $state['hidden_fields'] );

		$errors = $this->validate( $schema, $payload );
		$this->assertArrayNotHasKey( 'companies.0.reason', $errors );
		$this->assertArrayHasKey( 'companies.1.reason', $errors );

		// Hidden answers inside a group are not stored.
		$payload['companies'][0]['reason'] = 'typed while visible';
		$visible = ( new ConditionalLogic( '2026-10-12' ) )->visiblePayload( $schema, $payload );
		$this->assertArrayNotHasKey( 'reason', $visible['companies'][0] );
		$this->assertSame( 'AAPL', $visible['companies'][0]['ticker'] );
	}

	public function test_clean_keeps_known_keys_and_caps_at_max(): void {
		$node   = $this->schema()['fields'][1];
		$value  = array_fill( 0, 5, array( 'ticker' => 'T', 'evil' => 'x' ) );
		$clean  = Repeater::clean(
			$node,
			$value,
			static function ( array $schema, array $group ): array {
				$keys = array_column( $schema['fields'], 'key' );
				return array_intersect_key( $group, array_flip( $keys ) );
			}
		);
		$this->assertCount( 3, $clean );
		$this->assertSame( array( 'ticker' => 'T' ), $clean[0] );
	}

	public function test_answers_text_and_groups_for_pdf(): void {
		$payload = array(
			'email'     => 'a@b.co',
			'companies' => array(
				array( 'ticker' => 'AAPL', 'company' => 'Apple', 'shares' => '8', 'date' => '2024-02-29' ),
				array( 'ticker' => 'MSFT', 'shares' => '2' ),
			),
		);
		$rows = FieldMapper::answers( $this->schema(), $payload );
		$this->assertSame( array( 'email', 'companies' ), array_column( $rows, 'key' ) );
		$this->assertSame(
			"1. Ticker: AAPL; Company name: Apple; Number of shares: 8; Purchase date: 2024-02-29\n2. Ticker: MSFT; Number of shares: 2",
			$rows[1]['value']
		);
		$this->assertCount( 2, $rows[1]['groups'] );
		$this->assertSame( 'Ticker', $rows[1]['groups'][1][0]['label'] );

		// Children are not separate top-level fields.
		$this->assertSame( array( 'email', 'companies' ), array_column( FieldMapper::fields( $this->schema() ), 'key' ) );
	}

	public function test_csv_cells_line_up_groups_per_child(): void {
		$cells = Repeater::csvCells(
			array( array( 'ticker' => 'AAPL', 'shares' => '8' ), array( 'ticker' => 'MSFT' ) ),
			$this->schema()['fields'][1]
		);
		$this->assertSame( "AAPL\nMSFT", $cells['ticker'] );
		$this->assertSame( "8\n", $cells['shares'] );
		$this->assertSame( "\n", $cells['company'] );
	}
}
