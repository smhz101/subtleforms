<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 2.9.0 Date, Time and Date & time fields: the options each one offers, how
 * the inspector groups them, and the defaults a saved 2.8 field falls back to.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;

final class DateTimeFields290Test extends TestCase {

	private function controls( string $type ): array {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		FieldSettings::decorateAll( $registry );
		return array_column( $registry->get( $type )->inspectorControls, null, 'name' );
	}

	private function values( array $control ): array {
		return array_column( $control['options'], 'value' );
	}

	public function test_date_offers_every_option_in_the_brief(): void {
		$c = $this->controls( 'date' );
		foreach ( array( 'label', 'placeholder', 'description', 'format', 'customFormat', 'firstDay', 'minDate', 'maxDate', 'disablePast', 'disabledWeekdays', 'defaultMode' ) as $name ) {
			$this->assertArrayHasKey( $name, $c, $name );
			$this->assertNotEmpty( $c[ $name ]['help'] ?? $c[ $name ]['description'] ?? 'help', $name );
		}
		$this->assertSame( array( 'Y-m-d', 'd/m/Y', 'm/d/Y', 'd.m.Y', 'j F Y', 'D, j M Y', 'site', 'custom' ), $this->values( $c['format'] ) );
		$this->assertSame( array( 'site', '0', '1', '6' ), $this->values( $c['firstDay'] ) );
		$this->assertSame( array( 'none', 'today' ), $this->values( $c['defaultMode'] ) );
		$this->assertSame( 'date', $c['minDate']['type'] );
		$this->assertSame( 'date', $c['maxDate']['type'] );
		$this->assertSame( 'weekdays', $c['disabledWeekdays']['type'] );
	}

	public function test_custom_format_shows_only_for_the_custom_preset(): void {
		foreach ( array( 'date', 'time', 'datetime' ) as $type ) {
			$c = $this->controls( $type );
			$this->assertSame( array( 'format' => array( 'custom' ) ), $c['customFormat']['showWhen'], $type );
			$this->assertSame( 'text', $c['customFormat']['type'], $type );
		}
		$this->assertStringContainsString( 'd/m/Y', $this->controls( 'date' )['customFormat']['help'] );
	}

	public function test_format_presets_carry_a_live_example(): void {
		$c = $this->controls( 'date' );
		$labels = array_column( $c['format']['options'], 'label', 'value' );
		$this->assertSame( 'd/m/Y (31/03/2025)', $labels['d/m/Y'] );
		$this->assertSame( 'Y-m-d (2025-03-31)', $labels['Y-m-d'] );
	}

	public function test_time_options(): void {
		$c = $this->controls( 'time' );
		$this->assertSame( array( 'H:i', 'g:i A', 'site', 'custom' ), $this->values( $c['format'] ) );
		$this->assertSame( array( '1', '5', '10', '15', '30', '60' ), $this->values( $c['minuteStep'] ) );
		$this->assertSame( 'time', $c['minTime']['type'] );
		$this->assertSame( 'time', $c['maxTime']['type'] );
		$this->assertSame( array( 'none', 'now' ), $this->values( $c['defaultMode'] ) );
		$this->assertArrayNotHasKey( 'minDate', $c );
	}

	public function test_datetime_is_the_union(): void {
		$c = $this->controls( 'datetime' );
		$this->assertSame( array( 'Y-m-d H:i', 'd/m/Y H:i', 'm/d/Y g:i A', 'j F Y, g:i A', 'site', 'custom' ), $this->values( $c['format'] ) );
		foreach ( array( 'firstDay', 'minDate', 'maxDate', 'disablePast', 'disabledWeekdays', 'minuteStep', 'minTime', 'maxTime', 'defaultMode' ) as $name ) {
			$this->assertArrayHasKey( $name, $c, $name );
		}
	}

	public function test_sections_and_help(): void {
		foreach ( array( 'date', 'time', 'datetime' ) as $type ) {
			foreach ( $this->controls( $type ) as $name => $control ) {
				$expected = in_array( $name, array( 'placeholder', 'format', 'customFormat', 'firstDay' ), true ) ? 'appearance' : null;
				if ( $expected ) {
					$this->assertSame( $expected, $control['section'], "$type $name" );
				} elseif ( in_array( $name, array( 'label', 'description', 'minDate', 'maxDate', 'disablePast', 'disabledWeekdays', 'minuteStep', 'minTime', 'maxTime', 'defaultMode' ), true ) ) {
					$this->assertSame( 'general', $control['section'], "$type $name" );
				}
				if ( in_array( $name, array( 'label', 'placeholder', 'format', 'customFormat', 'firstDay', 'minDate', 'maxDate', 'disablePast', 'disabledWeekdays', 'minuteStep', 'minTime', 'maxTime', 'defaultMode' ), true ) ) {
					$this->assertNotEmpty( $control['help'] ?? '', "$type $name help" );
				}
			}
		}
	}

	public function test_a_saved_2_8_field_keeps_its_own_values(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		$attributes = $registry->get( 'date' )->fieldSpecificAttributes;
		// New fields default to the site format; a saved field keeps the text it was saved with.
		$this->assertSame( 'site', $attributes['format'] );
		$this->assertFalse( $attributes['disablePast'] );
		$this->assertSame( array(), $attributes['disabledWeekdays'] );
		$this->assertSame( 15, $registry->get( 'time' )->fieldSpecificAttributes['minuteStep'] );
	}
}
