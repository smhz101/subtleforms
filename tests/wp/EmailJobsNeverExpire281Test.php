<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * A notification email waits for WP-Cron in a store that does not expire
 * (issue 82). It used to wait in a transient for six hours, and an email whose
 * cron run came later was dropped without a word.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Async\AsyncDispatcher;

final class EmailJobsNeverExpire281Test extends TestCase {

	/** @var array[] */
	private $sent = array();

	protected function setUp(): void {
		parent::setUp();
		$this->sent = array();
		wp_unschedule_hook( 'subtleforms_async_email' );
		add_filter( 'pre_wp_mail', array( $this, 'catchMail' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_wp_mail', array( $this, 'catchMail' ), 10 );
		wp_unschedule_hook( 'subtleforms_async_email' );
		parent::tearDown();
	}

	public function catchMail( $pre, $atts ) {
		$this->sent[] = $atts;
		return true;
	}

	private function form(): int {
		return $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'm', 'key' => 'message', 'type' => 'textarea', 'label' => 'Message' ),
			),
			array(
				array( 'id' => 'save', 'type' => 'save', 'enabled' => true ),
				array(
					'id'      => 'notify',
					'type'    => 'email',
					'enabled' => true,
					'config'  => array( 'to' => 'owner@example.org', 'subject' => 'New lead from {field:name}', 'message' => "Message: {field:message}" ),
				),
			)
		);
	}

	/** The cron arguments of the queued email events. */
	private function queued(): array {
		$found = array();
		foreach ( _get_cron_array() as $list ) {
			foreach ( $list['subtleforms_async_email'] ?? array() as $event ) {
				$found[] = $event['args'][0];
			}
		}
		return $found;
	}

	private function storedName( array $reference ): string {
		return AsyncDispatcher::JOB_PREFIX . md5( $reference['job_ref'] );
	}

	public function test_the_details_wait_in_an_option_that_does_not_expire_and_is_not_autoloaded(): void {
		global $wpdb;
		$this->submit( $this->form(), array( 'name' => 'Ada', 'message' => 'Hello there' ) );
		$queued = $this->queued();
		$this->assertCount( 1, $queued );

		$name = $this->storedName( $queued[0] );
		$this->assertIsArray( get_option( $name ) );
		$this->assertFalse( get_transient( $name ), 'not a transient' );
		$this->assertContains( $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", $name ) ), array( 'no', 'off' ), 'not loaded on every request' );
		$this->assertFalse( (bool) get_option( '_transient_timeout_' . $name ) );
	}

	public function test_an_email_whose_cron_run_comes_late_is_still_sent(): void {
		$this->submit( $this->form(), array( 'name' => 'Ada', 'message' => 'Hello there' ) );
		$queued = $this->queued();
		$name   = $this->storedName( $queued[0] );

		// A day passes: what a transient would have lost is still here.
		$value              = get_option( $name );
		$value['stored_at'] = time() - DAY_IN_SECONDS;
		update_option( $name, $value, false );

		do_action( 'subtleforms_async_email', $queued[0] );

		$this->assertCount( 1, $this->sent );
		$this->assertSame( 'New lead from Ada', $this->sent[0]['subject'] );
		$this->assertStringContainsString( 'Hello there', $this->sent[0]['message'] );
		$this->assertFalse( get_option( $name ), 'deleted once it ran' );
	}

	public function test_an_email_whose_stored_details_are_gone_is_built_again_from_the_entry(): void {
		$this->submit( $this->form(), array( 'name' => 'Ada', 'message' => 'Budget 5000 USD' ) );
		$queued = $this->queued();
		$name   = $this->storedName( $queued[0] );

		// What an object cache eviction, an upgrade from the six hour
		// transient or the orphan cleanup leaves: nothing stored.
		delete_option( $name );
		delete_transient( $name );
		$this->assertNull( AsyncDispatcher::resolve( $queued[0] ) );

		do_action( 'subtleforms_async_email', $queued[0] );

		$this->assertCount( 1, $this->sent, 'the email is still sent' );
		$this->assertSame( array( 'owner@example.org' ), (array) $this->sent[0]['to'] );
		$this->assertSame( 'New lead from Ada', $this->sent[0]['subject'] );
		$this->assertStringContainsString( 'Budget 5000 USD', $this->sent[0]['message'] );
	}

	public function test_nothing_is_sent_when_the_entry_cannot_build_the_email(): void {
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada', 'message' => 'Hello' ) );
		$queued = $this->queued();
		delete_option( $this->storedName( $queued[0] ) );

		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'subtleforms_submissions', array( 'form_id' => $id ) );

		do_action( 'subtleforms_async_email', $queued[0] );
		$this->assertCount( 0, $this->sent );
	}

	public function test_a_job_queued_by_the_earlier_version_still_runs_from_its_transient(): void {
		AsyncDispatcher::dispatchEmail( array( 'to' => 'a@example.com', 'subject' => 'Hello', 'body' => 'Body', 'form_id' => 4 ) );
		$queued = $this->queued();
		$name   = $this->storedName( $queued[0] );
		$job    = get_option( $name )['job'];
		delete_option( $name );
		set_transient( $name, $job, 6 * HOUR_IN_SECONDS );

		do_action( 'subtleforms_async_email', $queued[0] );
		$this->assertCount( 1, $this->sent );
		$this->assertFalse( get_transient( $name ), 'the transient is deleted too' );
	}

	public function test_the_daily_cleanup_removes_details_left_for_more_than_a_week(): void {
		update_option( AsyncDispatcher::JOB_PREFIX . 'old', array( 'stored_at' => time() - 8 * DAY_IN_SECONDS, 'job' => array( 'to' => 'x@example.com' ) ), false );
		update_option( AsyncDispatcher::JOB_PREFIX . 'recent', array( 'stored_at' => time() - 2 * DAY_IN_SECONDS, 'job' => array( 'to' => 'x@example.com' ) ), false );
		update_option( AsyncDispatcher::JOB_PREFIX . 'unknown_age', array( 'to' => 'x@example.com' ), false );

		do_action( 'subtleforms_daily_cleanup' );

		$this->assertFalse( get_option( AsyncDispatcher::JOB_PREFIX . 'old' ) );
		$this->assertFalse( get_option( AsyncDispatcher::JOB_PREFIX . 'unknown_age' ) );
		$this->assertIsArray( get_option( AsyncDispatcher::JOB_PREFIX . 'recent' ) );
		delete_option( AsyncDispatcher::JOB_PREFIX . 'recent' );
	}
}
