<?php

/**
 * Regression tests for the form-schema save contract.
 *
 * Every test here covers the same failure: the validator carried a frozen list
 * of allowed values that something else — the builder UI, a form template, the
 * action registry — had already moved past. The result each time was a form
 * that loads and edits but returns 422 on every save, permanently, with no way
 * to fix it from the admin.
 *
 * Anything that widens what the builder can produce belongs here too.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;
use SubtleForms\Validation\ValidationException;

/**
 * @covers \SubtleForms\Validation\Schemas
 */
final class FormSchemaSaveTest extends TestCase {

	private RequestValidator $validator;

	protected function setUp(): void {
		$this->validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
	}

	/**
	 * Run a schema through the save contract.
	 *
	 * @param array $schema Schema body.
	 * @return array{0:bool,1:string} Whether it validated, and why not.
	 */
	private function save( array $schema ): array {
		try {
			$this->validator->validateOrFail(
				array(
					'activate' => false,
					'schema'   => $schema,
				),
				Schemas::get( Schemas::FORM_SCHEMA_SAVE )
			);
			return array( true, '' );
		} catch ( ValidationException $e ) {
			return array( false, implode( '; ', $e->getFields() ) );
		}
	}

	// ── metadata.type ──────────────────────────────────────────────────

	/**
	 * Templates write `multistep`; stored schemas and the builder write
	 * `multi-step`. Both reach the endpoint, so both have to be accepted.
	 *
	 * @dataProvider multiStepSpellings
	 */
	public function test_both_multi_step_spellings_are_accepted( string $spelling ): void {
		list( $ok, $why ) = $this->save(
			array(
				'metadata' => array( 'type' => $spelling ),
				'fields'   => array(),
			)
		);

		$this->assertTrue( $ok, "Rejected metadata.type '{$spelling}': {$why}" );
	}

	public function multiStepSpellings(): array {
		return array(
			'canonical' => array( 'multi-step' ),
			'template'  => array( 'multistep' ),
		);
	}

	public function test_an_unknown_form_type_is_still_rejected(): void {
		list( $ok ) = $this->save(
			array(
				'metadata' => array( 'type' => 'telepathic' ),
				'fields'   => array(),
			)
		);

		$this->assertFalse( $ok );
	}

	// ── actions[].type ─────────────────────────────────────────────────

	/**
	 * Action types are a runtime set: ActionRegistry owns them and extensions
	 * add to it. The compiler already soft-skips a type it cannot resolve, so
	 * refusing the save is the harsher and less useful of the two behaviours —
	 * it strands the whole form over one inert action.
	 *
	 * @dataProvider actionTypes
	 */
	public function test_any_action_type_survives_the_save( string $type ): void {
		list( $ok, $why ) = $this->save(
			array(
				'metadata' => array( 'type' => 'regular' ),
				'fields'   => array(),
				'actions'  => array( array( 'type' => $type, 'settings' => array() ) ),
			)
		);

		$this->assertTrue( $ok, "Rejected action type '{$type}': {$why}" );
	}

	public function actionTypes(): array {
		return array(
			'core save'           => array( 'save' ),
			'core email'          => array( 'email' ),
			'core webhook'        => array( 'webhook' ),
			'stored legacy alias' => array( 'email_notification' ),
			'extension supplied'  => array( 'crm_sync' ),
		);
	}

	public function test_an_action_still_needs_a_type(): void {
		list( $ok ) = $this->save(
			array(
				'metadata' => array( 'type' => 'regular' ),
				'fields'   => array(),
				'actions'  => array( array( 'settings' => array() ) ),
			)
		);

		$this->assertFalse( $ok, 'An action with no type should not validate.' );
	}

	// ── payment.currency ───────────────────────────────────────────────

	/**
	 * The Payments panel's currency picker is the list that matters: anything
	 * it offers has to save.
	 *
	 * @dataProvider offeredCurrencies
	 */
	public function test_every_offered_currency_saves( string $currency ): void {
		list( $ok, $why ) = $this->save(
			array(
				'metadata' => array(
					'type'    => 'payment',
					'payment' => array(
						'enabled'     => true,
						'currency'    => $currency,
						'amountType'  => 'fixed',
						'fixedAmount' => 10,
					),
				),
				'fields'   => array(),
			)
		);

		$this->assertTrue( $ok, "Rejected currency '{$currency}': {$why}" );
	}

	public function offeredCurrencies(): array {
		// Mirrors the options in resources/admin/components/builder/FormSettings.jsx.
		return array_map(
			static fn( $c ) => array( $c ),
			array( 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR' )
		);
	}

	// ── metadata keys the builder writes ───────────────────────────────

	/**
	 * Undeclared metadata keys are dropped rather than rejected, which is
	 * quieter and worse: the setting appears to save and is gone on reload.
	 */
	public function test_builder_metadata_keys_survive_the_round_trip(): void {
		$validated = $this->validator->validateOrFail(
			array(
				'activate' => false,
				'schema'   => array(
					'metadata' => array(
						'type'         => 'regular',
						'canvasWidth'  => 'wide',
						'integrations' => array( 'webhooks' => array( 'url' => 'https://example.test/hook' ) ),
						'appearance'   => array(
							'preset'   => 'compact',
							'tokens'   => array( 'colorPrimary' => '#4f5bd5' ),
							'variants' => array( 'input' => 'filled' ),
						),
					),
					'fields'   => array(),
				),
			),
			Schemas::get( Schemas::FORM_SCHEMA_SAVE )
		);

		$metadata = $validated['schema']['metadata'];

		$this->assertSame( 'wide', $metadata['canvasWidth'] );
		$this->assertArrayHasKey( 'integrations', $metadata );
		$this->assertSame( 'compact', $metadata['appearance']['preset'] );
		$this->assertSame( '#4f5bd5', $metadata['appearance']['tokens']['colorPrimary'] );
		$this->assertSame( 'filled', $metadata['appearance']['variants']['input'] );
	}

	/**
	 * A consent line is the label visitors read. A paragraph must save.
	 */
	public function test_a_consent_label_can_be_a_paragraph(): void {
		$label = str_repeat( 'Protect your investments. ', 16 );
		$this->assertGreaterThan( 255, strlen( $label ) );

		list( $ok, $why ) = $this->save(
			array(
				'fields' => array(
					array(
						'type'  => 'consent',
						'key'   => 'enroll',
						'label' => $label,
					),
				),
			)
		);

		$this->assertTrue( $ok, $why );
	}

	public function test_a_field_label_still_has_a_limit(): void {
		list( $ok, $why ) = $this->save(
			array(
				'fields' => array(
					array(
						'type'  => 'text',
						'key'   => 'name',
						'label' => str_repeat( 'a', 2001 ),
					),
				),
			)
		);

		$this->assertFalse( $ok );
		$this->assertStringContainsString( 'Maximum length is 2000', $why );
	}
}
