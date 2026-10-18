<?php
/**
 * Free reports day buckets.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Tools\ReportSeries;

/**
 * @covers \SubtleForms\Tools\ReportSeries
 */
final class ReportSeriesTest extends TestCase {

	public function test_missing_days_are_zero_and_order_is_oldest_first(): void {
		$series = ReportSeries::fillDays(
			array(
				'2026-10-18' => 4,
				'2026-10-16' => 1,
			),
			7,
			'2026-10-18'
		);

		$this->assertCount( 7, $series );
		$this->assertSame( '2026-10-12', $series[0]['date'] );
		$this->assertSame( 0, $series[0]['count'] );
		$this->assertSame( '2026-10-16', $series[4]['date'] );
		$this->assertSame( 1, $series[4]['count'] );
		$this->assertSame( '2026-10-18', $series[6]['date'] );
		$this->assertSame( 4, $series[6]['count'] );
	}

	public function test_window_is_clamped(): void {
		$this->assertCount( 1, ReportSeries::fillDays( array(), 0, '2026-10-18' ) );
		$this->assertCount( 90, ReportSeries::fillDays( array(), 400, '2026-10-18' ) );
	}
}
