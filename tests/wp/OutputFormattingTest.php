<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.4.0: one formatter for the entry screen, emails and the CSV export.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Repositories\SubmissionsRepository;

final class OutputFormattingTest extends TestCase {

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
		if ( isset( $event->hook ) && $event->hook === 'subtleforms_async_email' ) {
			$this->jobs[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	private function fields(): array {
		return array(
			array(
				'type'    => 'dropdown',
				'key'     => 'plan',
				'label'   => 'Plan',
				'options' => array(
					array( 'label' => 'Alpha', 'value' => 'a' ),
					array( 'label' => 'Beta', 'value' => 'b' ),
				),
			),
			array(
				'type'    => 'multiple_choice',
				'key'     => 'extras',
				'label'   => 'Extras',
				'options' => array(
					array( 'label' => 'One', 'value' => 'o1' ),
					array( 'label' => 'Two', 'value' => 'o2' ),
				),
			),
			array( 'type' => 'checkbox', 'key' => 'agree', 'label' => 'Agree' ),
			array(
				'type'    => 'select',
				'key'     => 'team',
				'label'   => 'Team',
				'options' => array( array( 'label' => 'Sales', 'value' => 'sales' ) ),
			),
			array(
				'type'           => 'checkbox_grid',
				'key'            => 'rate',
				'label'          => 'Rate us',
				'multiplePerRow' => false,
				'rows'           => array( 'Speed', 'Price' ),
				'columns'        => array( 'OK', 'Good' ),
			),
			array(
				'type'    => 'checkbox_grid',
				'key'     => 'slots',
				'label'   => 'Slots',
				'rows'    => array( 'Mon' ),
				'columns' => array( 'AM', 'PM' ),
			),
			array( 'type' => 'date', 'key' => 'day', 'label' => 'Day', 'format' => 'd/m/Y' ),
			array( 'type' => 'time', 'key' => 'at', 'label' => 'At', 'format' => 'g:i A' ),
			array( 'type' => 'datetime', 'key' => 'when', 'label' => 'When', 'format' => 'd/m/Y H:i' ),
			array( 'type' => 'file_upload', 'key' => 'doc', 'label' => 'Document' ),
		);
	}

	private function payload(): array {
		return array(
			'plan'   => 'b',
			'extras' => array( 'o1', 'o2' ),
			'agree'  => '1',
			'team'   => 'sales',
			'rate'   => array( 'Speed' => 'Good', 'Price' => 'OK' ),
			'slots'  => array( 'Mon' => array( 'AM' => true, 'PM' => true ) ),
			'day'    => '2026-06-15',
			'at'     => '09:30',
			'when'   => '2026-06-15T14:30',
			'doc'    => array(
				array( 'id' => str_repeat( 'c', 32 ), 'name' => 'doc.pdf', 'size' => 45, 'type' => 'application/pdf' ),
			),
		);
	}

	private function entry(): array {
		$formId  = $this->publish( $this->fields() );
		$entryId = ( new SubmissionsRepository() )->create(
			array(
				'form_id'        => $formId,
				'schema_version' => 1,
				'payload'        => $this->payload(),
				'status'         => 'completed',
			)
		);
		return array( $formId, $entryId );
	}

	/** FB-13, FF-25, FA-10, FA-11: the email reads labels, Yes, matrix rows and formatted dates. */
	public function test_email_uses_the_formatter() {
		$context = new SubmissionContext( 1, $this->payload() );
		$context->setMeta( 'form_schema', array( 'fields' => $this->fields() ) );
		$context->setMeta( 'submission_id', 77 );
		$context->setMeta( 'current_step_settings', array( 'to' => 'admin@example.com', 'subject' => 'New', 'body' => '{all_fields}' ) );
		( new EmailAction() )->handle( $context );
		$this->assertCount( 1, $this->jobs );
		$body = (string) $this->jobs[0]['body'];

		foreach ( array( 'Beta', 'One, Two', 'Sales', 'Speed: Good; Price: OK', 'Mon: AM, PM', '15/06/2026', '9:30 AM', '15/06/2026 14:30', 'doc.pdf (' ) as $expected ) {
			$this->assertStringContainsString( $expected, $body, $body );
		}
		$this->assertMatchesRegularExpression( '/Agree\W+Yes/', $body );
		$this->assertStringNotContainsString( 'Mon: Yes', $body );
		$this->assertStringNotContainsString( '2026-06-15', $body );
	}

	/** FA-12, FB-13, FA-10, FA-11: CSV cells use the formatter; uploads read as names with links. */
	public function test_csv_uses_the_formatter() {
		list( $formId, $entryId ) = $this->entry();
		$this->asAdmin();
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		$api  = new \SubtleForms\Api\SubmissionsApi( new \SubtleForms\Repositories\FormsRepository(), new SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );

		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId ) ) );
		$csv = base64_decode( $api->export_submissions_csv( $request )->get_data()['data']['csv'] );

		$this->assertStringContainsString( 'doc.pdf (', $csv );
		$this->assertStringContainsString( 'action=subtleforms_file', $csv );
		$this->assertStringContainsString( 'entry=' . $entryId, $csv );
		$this->assertStringNotContainsString( 'id: ', $csv );
		$this->assertStringNotContainsString( 'size: 45', $csv );
		foreach ( array( '"Beta"', '"One, Two"', '"Yes"', '"Sales"', '"Speed: Good; Price: OK"', '"Mon: AM, PM"', '"15/06/2026"', '"9:30 AM"', '"15/06/2026 14:30"' ) as $expected ) {
			$this->assertStringContainsString( $expected, $csv, $csv );
		}
	}

	/** FB-13, FF-25, FA-10, FA-11: the entry screen gets the same text from the server. */
	public function test_entry_api_sends_display_text() {
		list( , $entryId ) = $this->entry();
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions/' . $entryId );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$data    = rest_do_request( $request )->get_data()['data'];
		$display = $data['display'];

		$this->assertSame( 'Beta', $display['plan']['text'] );
		$this->assertSame( array( 'One', 'Two' ), $display['extras']['items'] );
		$this->assertSame( 'Yes', $display['agree']['text'] );
		$this->assertSame( 'Sales', $display['team']['text'] );
		$this->assertSame( 'Mon: AM, PM', $display['slots']['text'] );
		$this->assertSame( '15/06/2026', $display['day']['text'] );
		$this->assertSame( 'Rate us', $display['rate']['label'] );
		// The raw answers are still there for the screen's own widgets.
		$this->assertSame( 'b', $data['payload']['plan'] );
	}
}
