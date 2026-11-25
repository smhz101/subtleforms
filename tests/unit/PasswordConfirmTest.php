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
}
