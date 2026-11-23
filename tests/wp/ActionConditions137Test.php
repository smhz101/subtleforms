<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * A notification's conditions are kept when sent on the action, and the entry
 * log says when no add-on checked them (issue 137).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Repositories\LogsRepository;

final class ActionConditions137Test extends TestCase {

	private const NOTE = 'Sent without checking its conditions: SubtleForms Pro, which checks them, is not active.';

	/** @var array[] */
	private $queued = array();

	protected function setUp(): void {
		parent::setUp();
		$this->queued = array();
		add_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10, 2 );
		add_filter( 'pre_wp_mail', '__return_true' );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10 );
		remove_filter( 'pre_wp_mail', '__return_true' );
		remove_all_filters( 'subtleforms/logic/supports' );
		remove_all_filters( 'subtleforms/logic/passes' );
		parent::tearDown();
	}

	public function catchJob( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
			$this->queued[] = $event->args;
			return true;
		}
		return $pre;
	}

	private function logic(): array {
		return array(
			'action' => 'show',
			'groups' => array(
				array(
					'match' => 'all',
					'rules' => array( array( 'field' => 'dept', 'operator' => 'equals', 'value' => 'sales' ) ),
				),
			),
		);
	}

	private function fields(): array {
		return array(
			array( 'id' => 'f1', 'key' => 'dept', 'type' => 'text', 'label' => 'Department' ),
		);
	}

	private function emailAction( array $extra = array() ): array {
		return array_merge(
			array(
				'id'      => 'sales_mail',
				'type'    => 'email',
				'enabled' => true,
				'settings' => array(
					'to'      => 'sales@example.com',
					'subject' => 'Sales lead',
					'message' => 'Hello',
				),
			),
			$extra
		);
	}

	/** Pipeline events of the newest entry of a form, oldest first, for one action type. */
	private function events( int $formId, string $actionType = 'email' ): array {
		global $wpdb;
		$sid = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ) );
		$out = array();
		foreach ( ( new LogsRepository() )->findBySubmission( $sid ) as $row ) {
			$ctx = $row['context'];
			if ( ( $ctx['action_type'] ?? '' ) === $actionType && 'started' !== ( $ctx['status'] ?? '' ) ) {
				$out[] = $ctx;
			}
		}
		return $out;
	}

	private function schemaSaveInput( array $actions ): array {
		return array(
			'schema' => array(
				'fields'  => $this->fields(),
				'actions' => $actions,
			),
		);
	}

	private function saveSchemaThroughRest( int $formId, array $body ): array {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $formId . '/schema' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( $body ) );
		$response = rest_do_request( $request );
		$this->assertSame( 201, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$stored = ( new \SubtleForms\Repositories\FormsRepository() )->loadSchemaVersion( $formId );
		return is_array( $stored['schema'] ?? null ) ? $stored['schema'] : array();
	}

	public function test_a_condition_sent_on_the_action_is_stored_under_its_settings(): void {
		$formId  = $this->publish( $this->fields() );
		$action  = $this->emailAction( array( 'logic' => $this->logic() ) );
		$stored  = $this->saveSchemaThroughRest( $formId, array_merge( $this->schemaSaveInput( array( $action ) ), array( 'activate' => true ) ) );
		$first   = $stored['actions'][0] ?? array();

		$this->assertArrayNotHasKey( 'logic', $first, 'no top level logic is kept' );
		$this->assertSame( $this->logic(), $first['settings']['logic'] ?? null );
	}

	public function test_when_both_places_carry_logic_the_settings_one_is_kept(): void {
		$formId = $this->publish( $this->fields() );
		$own    = $this->logic();
		$own['groups'][0]['rules'][0]['value'] = 'billing';
		$action = $this->emailAction( array( 'logic' => $this->logic() ) );
		$action['settings']['logic'] = $own;
		$stored = $this->saveSchemaThroughRest( $formId, array_merge( $this->schemaSaveInput( array( $action ) ), array( 'activate' => true ) ) );
		$first  = $stored['actions'][0] ?? array();

		$this->assertArrayNotHasKey( 'logic', $first );
		$this->assertSame( $own, $first['settings']['logic'] ?? null );
	}

	public function test_moving_the_condition_keeps_settings_given_under_config(): void {
		$formId = $this->publish( $this->fields() );
		$action = array(
			'id'      => 'sales_mail',
			'type'    => 'email',
			'enabled' => true,
			'config'  => array( 'to' => 'sales@example.com', 'subject' => 'Sales lead', 'message' => 'Hello' ),
			'logic'   => $this->logic(),
		);
		$stored = $this->saveSchemaThroughRest( $formId, array_merge( $this->schemaSaveInput( array( $action ) ), array( 'activate' => true ) ) );
		$first  = $stored['actions'][0] ?? array();

		$this->assertSame( 'sales@example.com', $first['settings']['to'] ?? null );
		$this->assertSame( $this->logic(), $first['settings']['logic'] ?? null );
		$this->assertArrayNotHasKey( 'logic', $first );
	}

	public function test_without_an_add_on_the_action_runs_and_the_log_says_nobody_checked(): void {
		$action = $this->emailAction();
		$action['settings']['logic'] = $this->logic();
		$formId = $this->publish( $this->fields(), array( $action ) );

		$res = $this->submit( $formId, array( 'dept' => 'billing' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );

		$this->assertCount( 1, $this->queued, 'the email is still sent' );
		$events = $this->events( $formId );
		$this->assertCount( 1, $events );
		$this->assertSame( 'succeeded', $events[0]['status'] );
		$this->assertSame( self::NOTE, $events[0]['error'] );
	}

	public function test_an_action_without_conditions_logs_no_note(): void {
		$formId = $this->publish( $this->fields(), array( $this->emailAction() ) );
		$this->submit( $formId, array( 'dept' => 'billing' ) );

		$events = $this->events( $formId );
		$this->assertCount( 1, $events );
		$this->assertSame( 'succeeded', $events[0]['status'] );
		$this->assertEmpty( $events[0]['error'] );
	}

	public function test_with_an_add_on_that_checks_conditions_the_action_is_skipped_as_before(): void {
		add_filter( 'subtleforms/logic/supports', '__return_true' );
		add_filter( 'subtleforms/logic/passes', '__return_false' );

		$action = $this->emailAction();
		$action['settings']['logic'] = $this->logic();
		$formId = $this->publish( $this->fields(), array( $action ) );

		$this->submit( $formId, array( 'dept' => 'billing' ) );

		$this->assertCount( 0, $this->queued, 'nothing is sent' );
		$events = $this->events( $formId );
		$this->assertCount( 1, $events );
		$this->assertSame( 'skipped', $events[0]['status'] );
		$this->assertSame( 'conditions_not_met', $events[0]['error'] );
	}
}
