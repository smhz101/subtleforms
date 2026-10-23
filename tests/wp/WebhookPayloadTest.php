<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * The webhook "full" payload sends dependent dropdown answers as the label
 * chosen at each level (review of PR #27).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\Actions\WebhookAction;
use SubtleForms\Engine\SubmissionContext;

final class WebhookPayloadTest extends TestCase {

	/** @var array[] */
	private $jobs = array();

	protected function setUp(): void {
		parent::setUp();
		$this->jobs = array();
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_webhook' === $event->hook ) {
			$this->jobs[] = \SubtleForms\Async\AsyncDispatcher::resolve( $event->args[0] );
			return true;
		}
		return $pre;
	}

	private function chained( string $key ): array {
		return array(
			'type'   => 'chained_select',
			'key'    => $key,
			'label'  => 'Place',
			'levels' => array(
				array( 'label' => 'Country', 'options' => array( array( 'label' => 'Pakistan', 'value' => 'pakistan' ) ) ),
				array( 'label' => 'Province', 'options' => array( array( 'label' => 'Punjab', 'value' => 'punjab', 'parent' => 'pakistan' ) ) ),
			),
		);
	}

	public function test_full_payload_sends_dependent_dropdown_labels(): void {
		$fields  = array(
			$this->chained( 'place' ),
			array( 'type' => 'dropdown', 'key' => 'plan', 'label' => 'Plan', 'options' => array( array( 'label' => 'Alpha', 'value' => 'a' ) ) ),
			array(
				'type'     => 'repeat_container',
				'key'      => 'offices',
				'label'    => 'Offices',
				'children' => array( $this->chained( 'office_place' ), array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ) ),
			),
		);
		$payload = array(
			'place'   => array( 'pakistan', 'punjab' ),
			'plan'    => 'a',
			'offices' => array( array( 'office_place' => array( 'pakistan', 'punjab' ), 'city' => 'Lahore' ) ),
		);

		$context = new SubmissionContext( 1, $payload );
		$context->setMeta( 'form_schema', array( 'fields' => $fields ) );
		$context->setMeta( 'submission_id', 91 );
		$context->setMeta( 'current_step_settings', array( 'url' => 'https://93.184.216.34/receive', 'payload_mode' => 'full' ) );
		( new WebhookAction() )->handle( $context );

		$this->assertCount( 1, $this->jobs );
		// 2.4.1: answers keyed by field are under "fields".
		$body = json_decode( (string) $this->jobs[0]['body'], true )['fields'];
		$this->assertSame( array( 'Pakistan', 'Punjab' ), $body['place'] );
		$this->assertSame( array( 'Pakistan', 'Punjab' ), $body['offices'][0]['office_place'] );
		// Other answers are sent as stored, as before.
		$this->assertSame( 'a', $body['plan'] );
		$this->assertSame( 'Lahore', $body['offices'][0]['city'] );
	}
}
