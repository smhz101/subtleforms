<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Import offer eligibility and state (2.7.2).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\ImportOffer;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class ImportOfferTest extends TestCase {

	protected function setUp(): void {
		require_once __DIR__ . '/fixtures/import-offer-stubs.php';
		$GLOBALS['sf_test_options']  = array();
		$GLOBALS['wpdb']             = new \SF_Activator_Wpdb();
		ImportOffer::$testFormsCount = null;
		ImportOffer::$testSources    = null;
	}

	protected function tearDown(): void {
		ImportOffer::$testFormsCount = null;
		ImportOffer::$testSources    = null;
	}

	private function sampleSources(): array {
		return array(
			array(
				'id'         => 'cf7',
				'label'      => 'Contact Form 7',
				'active'     => true,
				'count'      => 2,
				'can_import' => true,
			),
			array(
				'id'         => 'wpforms',
				'label'      => 'WPForms',
				'active'     => false,
				'count'      => 1,
				'can_import' => false,
			),
		);
	}

	public function test_defer_sets_notice_and_dismiss_sets_dismissed(): void {
		ImportOffer::defer();
		$this->assertSame( 'notice', get_option( ImportOffer::OPTION ) );
		ImportOffer::dismiss();
		$this->assertSame( 'dismissed', get_option( ImportOffer::OPTION ) );
	}

	public function test_status_shows_modal_when_pending_and_eligible(): void {
		update_option( ImportOffer::OPTION, 'pending', true );
		ImportOffer::$testFormsCount = 0;
		ImportOffer::$testSources    = $this->sampleSources();

		$status = ImportOffer::status();
		$this->assertSame( 'modal', $status['offer'] );
		$this->assertCount( 2, $status['sources'] );
		$this->assertSame( array( 'Contact Form 7', 'WPForms' ), $status['labels'] );
	}

	public function test_status_shows_notice_after_defer(): void {
		ImportOffer::$testFormsCount = 0;
		ImportOffer::$testSources    = $this->sampleSources();
		ImportOffer::defer();

		$status = ImportOffer::status();
		$this->assertSame( 'notice', $status['offer'] );
	}

	public function test_status_null_when_dismissed(): void {
		ImportOffer::$testFormsCount = 0;
		ImportOffer::$testSources    = $this->sampleSources();
		ImportOffer::dismiss();

		$status = ImportOffer::status();
		$this->assertNull( $status['offer'] );
	}

	public function test_status_null_when_site_has_forms(): void {
		update_option( ImportOffer::OPTION, 'pending', true );
		ImportOffer::$testFormsCount = 3;
		ImportOffer::$testSources    = $this->sampleSources();

		$status = ImportOffer::status();
		$this->assertNull( $status['offer'] );
	}

	public function test_status_null_when_no_source_forms(): void {
		update_option( ImportOffer::OPTION, 'pending', true );
		ImportOffer::$testFormsCount = 0;
		ImportOffer::$testSources    = array();

		$status = ImportOffer::status();
		$this->assertNull( $status['offer'] );
	}

	public function test_lazy_pending_when_option_none_and_eligible(): void {
		update_option( ImportOffer::OPTION, 'none', true );
		ImportOffer::$testFormsCount = 0;
		ImportOffer::$testSources    = $this->sampleSources();

		$status = ImportOffer::status();
		$this->assertSame( 'modal', $status['offer'] );
		$this->assertSame( 'pending', get_option( ImportOffer::OPTION ) );
	}

	public function test_evaluate_and_store_sets_pending_when_eligible(): void {
		ImportOffer::$testFormsCount = 0;
		ImportOffer::$testSources    = $this->sampleSources();
		ImportOffer::evaluateAndStore();
		$this->assertSame( 'pending', get_option( ImportOffer::OPTION ) );
	}

	public function test_evaluate_and_store_sets_none_when_not_eligible(): void {
		ImportOffer::$testFormsCount = 1;
		ImportOffer::$testSources    = $this->sampleSources();
		ImportOffer::evaluateAndStore();
		$this->assertSame( 'none', get_option( ImportOffer::OPTION ) );
	}
}
