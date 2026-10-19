<?php

/**
 * Submissions inbox choices stay inside the allowed sets.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\Settings;

/**
 * @covers \SubtleForms\Support\Settings
 */
final class InboxViewTest extends TestCase {

	public function test_unknown_choices_fall_back(): void {
		$this->assertSame( 'default', Settings::inboxChoice( 'density', 'roomy' ) );
		$this->assertSame( 'compact', Settings::inboxChoice( 'density', 'compact' ) );
		$this->assertSame( 'right', Settings::inboxChoice( 'reading_pane', 'left' ) );
		$this->assertSame( 'below', Settings::inboxChoice( 'reading_pane', 'below' ) );
		$this->assertSame( 'off', Settings::inboxChoice( 'reading_pane', 'off' ) );
	}

	public function test_validate_keeps_inbox_settings(): void {
		$settings = new Settings();
		$valid    = $settings->validate(
			array(
				'submissions_density'      => 'comfortable',
				'submissions_reading_pane' => 'off',
			)
		);

		$this->assertSame( 'comfortable', $valid['submissions_density'] );
		$this->assertSame( 'off', $valid['submissions_reading_pane'] );
	}

	public function test_validate_rejects_an_unknown_density(): void {
		$settings = new Settings();

		$this->expectException( \InvalidArgumentException::class );
		$settings->validate( array( 'submissions_density' => 'roomy' ) );
	}
}
