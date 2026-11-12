<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * 2.9.0 date and time limits: the shared vectors the browser also runs, the
 * server wiring, and a saved 2.8 schema.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\DateRules;
use SubtleForms\Engine\FieldValidator;

final class DateLimits290Test extends TestCase {

	private function vectors(): array {
		return json_decode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/date-limit-vectors.json' ), true );
	}

	private function validate( array $field, $value ): array {
		$schema = array( 'fields' => array( $field ) );
		return ( new FieldValidator() )->validate( $schema, array( $field['key'] => $value ), array( 'hidden_fields' => array(), 'required_fields' => array() ) );
	}

	public function test_date_vectors(): void {
		foreach ( $this->vectors()['date'] as $i => $v ) {
			$message = DateRules::dateMessage( $v['value'], $v['config'], 'date', $v['today'] );
			$this->assertSame( $v['message'], (string) $message, "date vector $i" );
		}
	}

	public function test_datetime_vectors(): void {
		foreach ( $this->vectors()['datetime'] as $i => $v ) {
			$message = DateRules::dateMessage( $v['value'], $v['config'], 'datetime', $v['today'] );
			$this->assertSame( $v['message'], (string) $message, "datetime vector $i" );
		}
	}

	public function test_time_vectors(): void {
		foreach ( $this->vectors()['time'] as $i => $v ) {
			$message = DateRules::timeMessage( $v['value'], $v['config'], $v['mode'] );
			$this->assertSame( $v['message'], (string) $message, "time vector $i" );
		}
	}

	public function test_the_validator_enforces_a_relative_minimum(): void {
		$field     = array( 'key' => 'when', 'type' => 'date', 'config' => array( 'minDate' => 'today' ) );
		$yesterday = gmdate( 'Y-m-d', strtotime( DateRules::today() . ' 12:00:00 UTC' ) - 86400 );
		$result    = $this->validate( $field, $yesterday );
		$this->assertFalse( $result['valid'] );
		$this->assertStringStartsWith( 'Pick a date on or after', $result['errors']['when'] );
		$this->assertTrue( $this->validate( $field, DateRules::today() )['valid'] );
	}

	public function test_the_validator_enforces_weekdays_and_past_dates(): void {
		$field = array( 'key' => 'when', 'type' => 'date', 'config' => array( 'disabledWeekdays' => array( 0 ) ) );
		$this->assertSame( 'Sundays are not available.', $this->validate( $field, '2025-03-16' )['errors']['when'] );
		$this->assertTrue( $this->validate( $field, '2025-03-17' )['valid'] );

		$past = array( 'key' => 'when', 'type' => 'date', 'config' => array( 'disablePast' => true ) );
		$this->assertSame( 'Pick a later date.', $this->validate( $past, '2001-01-01' )['errors']['when'] );
	}

	public function test_the_validator_enforces_times_in_time_and_datetime_fields(): void {
		$time = array( 'key' => 't', 'type' => 'time', 'config' => array( 'minTime' => '09:00', 'maxTime' => '17:00' ) );
		$this->assertSame( 'Pick a time between 09:00 and 17:00.', $this->validate( $time, '18:00' )['errors']['t'] );
		$this->assertTrue( $this->validate( $time, '12:00' )['valid'] );

		$both = array( 'key' => 'dt', 'type' => 'datetime', 'config' => array( 'minTime' => '09:00', 'maxTime' => '17:00' ) );
		$this->assertSame( 'Pick a time between 09:00 and 17:00.', $this->validate( $both, '2025-03-17T18:00' )['errors']['dt'] );
		$this->assertTrue( $this->validate( $both, '2025-03-17T10:00' )['valid'] );
		// The time may still be left out.
		$this->assertTrue( $this->validate( $both, '2025-03-17' )['valid'] );
	}

	public function test_a_saved_2_8_schema_validates_the_same(): void {
		// 2.8 stored a free text format and a relative minimum; neither has a
		// new setting beside it.
		$field = array(
			'key'    => 'when',
			'type'   => 'date',
			'config' => array( 'format' => 'Y-m-d', 'minDate' => 'today' ),
		);
		$this->assertTrue( $this->validate( $field, DateRules::today() )['valid'] );
		$this->assertSame( 'Please enter a valid date.', $this->validate( $field, 'tomorrow-ish' )['errors']['when'] );
		// Stored values never change shape.
		$this->assertTrue( $this->validate( array( 'key' => 't', 'type' => 'time', 'config' => array( 'format' => 'H:i' ) ), '14:30' )['valid'] );
		$this->assertTrue( $this->validate( array( 'key' => 'd', 'type' => 'datetime', 'config' => array( 'format' => 'Y-m-d H:i' ) ), '2025-03-31T14:30' )['valid'] );
	}
}
