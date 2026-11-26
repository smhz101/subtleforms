<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Password confirmation (server side, issue 190).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;

/**
 * @covers \SubtleForms\Engine\FieldValidator
 */
final class PasswordConfirmTest extends TestCase {

	private function error( array $payload, bool $on = true, bool $nested = false ) {
		$field = array( 'key' => 'pw', 'type' => 'password' );
		if ( $nested ) {
			$field['config'] = array( 'requireConfirmation' => $on );
		} else {
			$field['requireConfirmation'] = $on;
		}
		$schema = array(
			'fields' => array(
				array( 'type' => 'two_column_container', 'key' => 'cols', 'columns' => array( array( 'fields' => array( $field ) ) ) ),
			),
		);
		$result = ( new FieldValidator() )->validate( $schema, $payload, array( 'hidden_fields' => array(), 'required_fields' => array() ) );
		return $result['errors']['pw'] ?? null;
	}

	public function test_a_mismatch_is_rejected() {
		$this->assertSame( 'The passwords do not match.', $this->error( array( 'pw' => 'Secret123!', 'pw_confirm' => 'Other123!' ) ) );
	}

	public function test_a_missing_or_empty_confirmation_is_rejected() {
		$this->assertSame( 'The passwords do not match.', $this->error( array( 'pw' => 'Secret123!' ) ) );
		$this->assertSame( 'The passwords do not match.', $this->error( array( 'pw' => 'Secret123!', 'pw_confirm' => '' ) ) );
	}

	public function test_a_match_is_accepted() {
		$this->assertNull( $this->error( array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!' ) ) );
		$this->assertNull( $this->error( array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!' ), true, true ) );
	}

	public function test_the_setting_off_ignores_the_confirmation() {
		$this->assertNull( $this->error( array( 'pw' => 'Secret123!' ), false ) );
		$this->assertNull( $this->error( array( 'pw' => 'Secret123!', 'pw_confirm' => 'x' ), false, true ) );
	}

	private function schema(): array {
		return array( 'fields' => array( array( 'key' => 'pw', 'type' => 'password', 'requireConfirmation' => true ) ) );
	}

	public function test_the_first_write_never_holds_the_confirmation() {
		$stored = \SubtleForms\Api\PublicSubmitApi::storablePayload( array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!', 'name' => 'A' ), $this->schema() );
		$this->assertArrayNotHasKey( 'pw_confirm', $stored );
		$this->assertSame( 'A', $stored['name'] );
	}

	public function test_the_confirmation_is_restored_as_typed_beside_the_password() {
		$raw      = array( 'pw' => ' Secret<b>123!</b> ', 'pw_confirm' => ' Secret<b>123!</b> ' );
		$cleaned  = \SubtleForms\Validation\Sanitizer::sanitizeArrayDeep( $raw );
		$api      = ( new \ReflectionClass( \SubtleForms\Api\PublicSubmitApi::class ) )->newInstanceWithoutConstructor();
		$method   = new \ReflectionMethod( $api, 'restoreRichTextValues' );
		$method->setAccessible( true );
		$restored = $method->invoke( $api, $cleaned, $raw, $this->schema() );
		$this->assertSame( $raw['pw'], $restored['pw'] );
		$this->assertSame( $raw['pw_confirm'], $restored['pw_confirm'] );
		$this->assertNull( $this->error( $restored ) );
	}

	private function repeaterSchema(): array {
		return array(
			'fields' => array(
				array(
					'type'     => 'repeat_container',
					'key'      => 'people',
					'children' => array( array( 'key' => 'pw', 'type' => 'password', 'requireConfirmation' => true ) ),
				),
			),
		);
	}

	private function rowErrors( array $rows ): array {
		$schema   = $this->repeaterSchema();
		$expanded = \SubtleForms\Support\Repeater::expandForValidation( $schema, array( 'people' => $rows ) );
		$result   = ( new FieldValidator() )->validate( $expanded['schema'], $expanded['payload'], array( 'hidden_fields' => array(), 'required_fields' => array() ) );
		return $result['errors'];
	}

	public function test_a_mismatch_in_one_repeater_row_is_keyed_to_that_row() {
		$errors = $this->rowErrors(
			array(
				array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!' ),
				array( 'pw' => 'Secret123!', 'pw_confirm' => 'Other123!' ),
				array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!' ),
			)
		);
		$this->assertSame( array( 'people.1.pw' => 'The passwords do not match.' ), $errors );
	}

	public function test_matching_repeater_rows_pass() {
		$row = array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!' );
		$this->assertSame( array(), $this->rowErrors( array( $row, $row ) ) );
	}

	public function test_repeater_rows_are_stored_without_the_confirmation() {
		$row    = array( 'pw' => 'Secret123!', 'pw_confirm' => 'Secret123!' );
		$stored = \SubtleForms\Api\PublicSubmitApi::storablePayload( array( 'people' => array( $row, $row ) ), $this->repeaterSchema() );
		foreach ( $stored['people'] as $r ) {
			$this->assertArrayNotHasKey( 'pw_confirm', $r );
		}
		$stripped = \SubtleForms\Support\Repeater::stripConfirmations( array( 'people' => array( $row, $row ) ), $this->repeaterSchema() );
		foreach ( $stripped['people'] as $r ) {
			$this->assertArrayNotHasKey( 'pw_confirm', $r );
			$this->assertSame( 'Secret123!', $r['pw'] );
		}
	}
}
