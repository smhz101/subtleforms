<?php
/**
 * The "selected" webhook payload and the header rules (2.5.0).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Actions\WebhookAction;
use SubtleForms\Support\Webhooks;

/**
 * @coversNothing
 */
final class Webhooks250Test extends TestCase {

	private function schema(): array {
		return array(
			'metadata' => array( 'title' => 'Contact' ),
			'fields'   => array(
				array( 'type' => 'text', 'key' => 'name', 'label' => 'Name' ),
				array( 'type' => 'email', 'key' => 'email', 'label' => 'Email' ),
				array( 'type' => 'password', 'key' => 'pass', 'label' => 'Password' ),
				array( 'type' => 'signature', 'key' => 'sign', 'label' => 'Signature' ),
				array(
					'type'     => 'repeat_container',
					'key'      => 'offices',
					'label'    => 'Offices',
					'children' => array( array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ) ),
				),
			),
		);
	}

	private function entry(): array {
		return array(
			'form_id'          => 7,
			'form_title'       => 'Contact',
			'submission_id'    => 41,
			'created_at'       => '2026-10-21T10:00:00+00:00',
			'status'           => 'completed',
			'page_url'         => 'https://example.com/contact/',
			'ip_address'       => '203.0.113.9',
			'user_agent'       => 'Agent/1.0',
			'user_id'          => 3,
			'payment_amount'   => 25.5,
			'payment_currency' => 'USD',
			'payment_status'   => 'paid',
		);
	}

	private function answers(): array {
		return array(
			'name'    => 'Ann',
			'email'   => 'ann@example.com',
			'pass'    => 'hunter2',
			'sign'    => 'data:image/png;base64,AAAA',
			'offices' => array( array( 'city' => 'Lahore' ) ),
		);
	}

	public function test_form_group_sends_only_the_ticked_keys(): void {
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'form_id' ) );
		$this->assertSame( array( 'event' => 'submission.created', 'form_id' => 7 ), $body );

		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'form_title', 'form_id' ) );
		$this->assertSame( 7, $body['form_id'] );
		$this->assertSame( 'Contact', $body['form_title'] );
	}

	public function test_submission_group(): void {
		$all  = array( 'submission_id', 'created_at', 'status', 'page_url', 'ip_address', 'user_agent', 'user_id' );
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), $all );
		$this->assertSame( 41, $body['submission_id'] );
		$this->assertSame( '2026-10-21T10:00:00+00:00', $body['created_at'] );
		$this->assertSame( 'completed', $body['status'] );
		$this->assertSame( 'https://example.com/contact/', $body['page_url'] );
		$this->assertSame( '203.0.113.9', $body['ip_address'] );
		$this->assertSame( 'Agent/1.0', $body['user_agent'] );
		$this->assertSame( 3, $body['user_id'] );
		$this->assertArrayNotHasKey( 'fields', $body );
		$this->assertArrayNotHasKey( 'form_id', $body );
	}

	public function test_answers_group_sends_one_entry_per_ticked_field_and_a_repeater_as_one(): void {
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'field:name', 'field:offices' ) );
		$this->assertSame(
			array(
				'name'    => 'Ann',
				'offices' => array( array( 'city' => 'Lahore' ) ),
			),
			(array) $body['fields']
		);
		$this->assertArrayNotHasKey( 'answers', $body );
	}

	public function test_labels_option_adds_the_labelled_list_for_ticked_fields_only(): void {
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'field:email', Webhooks::LABELS_OPTION ) );
		$this->assertSame( array( array( 'key' => 'email', 'label' => 'Email', 'value' => 'ann@example.com' ) ), $body['answers'] );
	}

	public function test_payment_group(): void {
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'payment_amount', 'payment_currency', 'payment_status' ) );
		$this->assertSame( array( 'amount' => 25.5, 'currency' => 'USD', 'status' => 'paid' ), $body['payment'] );

		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'payment_currency' ) );
		$this->assertSame( array( 'currency' => 'USD' ), $body['payment'] );
	}

	public function test_unknown_keys_and_removed_fields_are_skipped(): void {
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'nonsense', 'field:gone', 'field:name', 'field:', '' ) );
		$this->assertSame( array( 'name' => 'Ann' ), (array) $body['fields'] );
		$this->assertArrayNotHasKey( 'nonsense', $body );
	}

	public function test_sensitive_fields_are_never_sent_even_when_requested(): void {
		$body = Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array( 'field:pass', 'field:sign', 'field:name', Webhooks::LABELS_OPTION ) );
		$json = (string) json_encode( $body );
		$this->assertSame( array( 'name' => 'Ann' ), (array) $body['fields'] );
		$this->assertStringNotContainsString( 'hunter2', $json );
		$this->assertStringNotContainsString( 'base64', $json );
		$this->assertStringNotContainsString( 'Password', $json );
		$this->assertArrayNotHasKey( 'pass', Webhooks::sendableFields( $this->schema() ) );
		$this->assertArrayNotHasKey( 'sign', Webhooks::sendableFields( $this->schema() ) );
	}

	public function test_a_ticked_field_without_an_answer_is_sent_as_null(): void {
		$body = Webhooks::selectedBody( $this->schema(), array( 'name' => 'Ann' ), $this->entry(), array( 'field:name', 'field:email' ) );
		$this->assertSame( array( 'name' => 'Ann', 'email' => null ), (array) $body['fields'] );
	}

	public function test_an_empty_selection_sends_only_the_event(): void {
		$this->assertSame( array( 'event' => 'submission.created' ), Webhooks::selectedBody( $this->schema(), $this->answers(), $this->entry(), array() ) );
	}

	public function test_header_rules(): void {
		$this->assertSame( '', Webhooks::headerProblem( 'X-Source', 'subtleforms' ) );
		$this->assertSame( '', Webhooks::headerProblem( 'Authorization', 'Bearer abc' ) );
		$this->assertSame( 'invalid_name', Webhooks::headerProblem( 'Bad Name', 'x' ) );
		$this->assertSame( 'invalid_name', Webhooks::headerProblem( 'X:Y', 'x' ) );
		$this->assertSame( 'invalid_name', Webhooks::headerProblem( '', 'x' ) );
		$this->assertSame( 'blocked', Webhooks::headerProblem( 'Host', 'evil.example' ) );
		$this->assertSame( 'blocked', Webhooks::headerProblem( 'content-length', '1' ) );
		$this->assertSame( 'blocked', Webhooks::headerProblem( 'X-SubtleForms-Signature', 'sha256=0' ) );
		$this->assertSame( 'invalid_value', Webhooks::headerProblem( 'X-A', "a\r\nX-B: b" ) );
	}

	public function test_safe_headers_drops_what_the_rules_refuse_and_keeps_the_rest(): void {
		$this->assertSame(
			array( 'X-Source' => 'sf', 'Authorization' => 'Bearer t' ),
			Webhooks::safeHeaders(
				array(
					'X-Source'      => 'sf',
					'Host'          => 'evil',
					'Bad Name'      => 'x',
					'X-Split'       => "a\nb",
					'Authorization' => 'Bearer t',
				)
			)
		);
	}

	public function test_custom_template_fills_entry_tags_and_leaves_other_tags_alone(): void {
		$template = array(
			'ip'    => '{{entry:ip_address}}',
			'who'   => '{{field:name}}',
			'title' => '{{form_title}}',
			'id'    => '{{entry_id}}',
			'status'=> '{entry:status}',
		);
		$filled   = WebhookAction::fillCustomPayload( $template, array( 'name' => 'Ann', 'status' => 'my own answer' ), array( 'form_title' => 'Contact', 'entry_id' => '41', 'entry' => $this->entry() ) );
		$this->assertSame( '203.0.113.9', $filled['ip'] );
		$this->assertSame( 'Ann', $filled['who'] );
		$this->assertSame( 'Contact', $filled['title'] );
		$this->assertSame( '41', $filled['id'] );
		$this->assertSame( 'completed', $filled['status'] );
	}

	public function test_custom_template_without_entry_values_is_unchanged(): void {
		$filled = WebhookAction::fillCustomPayload( array( 'n' => '{{name}}', 'f' => '{form_title}' ), array( 'name' => 'Ann' ), array( 'form_title' => 'Contact' ) );
		$this->assertSame( array( 'n' => 'Ann', 'f' => 'Contact' ), $filled );
	}

	public function test_raw_tag_keeps_a_list_a_list_and_never_offers_secrets(): void {
		$raw    = Webhooks::rawAnswers( $this->schema(), $this->answers() );
		$filled = WebhookAction::fillCustomPayload(
			array( 'offices' => '{{raw:offices}}', 'pass' => '{{raw:pass}}', 'missing' => '{{raw:nope}}', 'mixed' => 'x {{raw:name}}' ),
			array(),
			array( 'raw' => $raw )
		);
		$this->assertSame( array( array( 'city' => 'Lahore' ) ), $filled['offices'] );
		$this->assertNull( $filled['pass'] );
		$this->assertNull( $filled['missing'] );
		// Inside longer text it is not a raw value, and the unknown tag is empty like any other.
		$this->assertSame( 'x ', $filled['mixed'] );
	}
}
