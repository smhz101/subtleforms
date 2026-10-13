<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * QA-20: the dashboard performance selector is not capped at 10 forms.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Api\DashboardApi;

require_once dirname( __DIR__, 2 ) . '/src/Api/DashboardApi.php';

class DashboardPerformanceFormsTest extends TestCase {

	/**
	 * @param int $count
	 * @return array
	 */
	private function page( int $count ): array {
		$rows = array();
		for ( $i = 0; $i < $count; $i++ ) {
			$rows[] = array( 'id' => $i + 1 );
		}
		return $rows;
	}

	public function test_selector_query_is_not_capped_at_ten(): void {
		$calls = array();
		$pages = array(
			$this->page( DashboardApi::PERFORMANCE_FORM_BATCH ),
			$this->page( 3 ),
		);
		$index = 0;

		$forms = DashboardApi::collectPerformanceForms(
			function ( array $args ) use ( &$calls, &$index, $pages ) {
				$calls[] = $args;
				$page    = $pages[ $index ] ?? array();
				$index++;
				return $page;
			}
		);

		$this->assertCount( DashboardApi::PERFORMANCE_FORM_BATCH + 3, $forms );
		$this->assertCount( 2, $calls );
		$this->assertNotSame( 10, DashboardApi::PERFORMANCE_FORM_BATCH );
		$this->assertGreaterThan( 10, DashboardApi::PERFORMANCE_FORM_BATCH );

		foreach ( $calls as $args ) {
			$this->assertSame( DashboardApi::PERFORMANCE_FORM_BATCH, $args['limit'] );
			$this->assertNotSame( 10, $args['limit'] );
			$this->assertArrayNotHasKey( 'status', $args );
			$this->assertSame( 'updated_at', $args['orderby'] );
			$this->assertSame( 'DESC', $args['order'] );
		}

		$this->assertSame( 0, $calls[0]['offset'] );
		$this->assertSame( DashboardApi::PERFORMANCE_FORM_BATCH, $calls[1]['offset'] );
	}

	public function test_short_first_page_does_not_request_another(): void {
		$calls = 0;
		$forms = DashboardApi::collectPerformanceForms(
			function () use ( &$calls ) {
				$calls++;
				return array(
					array( 'id' => 1 ),
					array( 'id' => 2 ),
				);
			}
		);

		$this->assertSame( 1, $calls );
		$this->assertCount( 2, $forms );
	}
}
