<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.6.1: the shortcode and the block print the form's public data into the
 * page, so the form is drawn without a request to the REST API.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Frontend\FrontendAssets;
use SubtleForms\Frontend\InlineData;

final class InlineFormData261Test extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		InlineData::resetForTests();
		FrontendAssets::resetForTests();
		wp_set_current_user( 0 );
	}

	protected function tearDown(): void {
		InlineData::resetForTests();
		FrontendAssets::resetForTests();
		remove_all_filters( 'subtleforms/frontend/inline_form_data' );
		parent::tearDown();
	}

	private function shortcode( int $formId ): string {
		return \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Frontend\Shortcode::class )->render( array( 'id' => $formId ) );
	}

	/** The JSON inside the printed tag, decoded. */
	private function printed( string $html, int $formId ): ?array {
		if ( ! preg_match( '#<script type="application/json" id="sf-form-data-' . $formId . '">(.*?)</script>#s', $html, $m ) ) {
			return null;
		}
		$data = json_decode( $m[1], true );
		return is_array( $data ) ? $data : null;
	}

	/** The server-printed outline: the container, without the data tag. */
	private function outline( string $html ): string {
		$end = strpos( $html, '<script' );
		return false === $end ? $html : substr( $html, 0, $end );
	}

	private function contact(): int {
		return $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Your name', 'required' => true ),
				array( 'id' => 'm', 'key' => 'message', 'type' => 'textarea', 'label' => 'Message' ),
			)
		);
	}

	/** The route's answer to a visitor. */
	private function route( int $formId ): array {
		wp_set_current_user( 0 );
		$response = rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $formId . '/schema' ) );
		$this->assertSame( 200, $response->get_status() );
		$body = $response->get_data();
		return $body['data'] ?? $body;
	}

	public function test_shortcode_prints_what_the_route_returns(): void {
		$formId = $this->contact();
		$html   = $this->shortcode( $formId );
		$data   = $this->printed( $html, $formId );

		$this->assertIsArray( $data );
		$route = $this->route( $formId );
		$this->assertSame( $route['schema'], $data['schema'] );
		$this->assertSame( $route['form'], $data['form'] );
		$this->assertSame( $route['version'], $data['version'] );
		$this->assertNotNull( \SubtleForms\Engine\SpamProtection::ticket_time( $data['spam_token'], $formId ) );
	}

	public function test_block_prints_the_same_data(): void {
		$formId = $this->contact();
		$html   = do_blocks( '<!-- wp:subtleforms/form {"formId":' . $formId . '} /-->' );
		$data   = $this->printed( $html, $formId );

		$this->assertIsArray( $data );
		$this->assertSame( $this->route( $formId )['schema'], $data['schema'] );
	}

	public function test_a_second_container_for_the_same_form_reuses_the_tag(): void {
		$formId = $this->contact();
		$first  = $this->shortcode( $formId );
		$second = $this->shortcode( $formId );

		$this->assertSame( 1, substr_count( $first, 'id="sf-form-data-' . $formId . '"' ) );
		$this->assertSame( 0, substr_count( $second, 'sf-form-data-' ) );
		$this->assertStringContainsString( 'subtleforms-skeleton', $second );
	}

	public function test_private_data_is_never_printed(): void {
		$secrets = array(
			'notify_to'   => 'owner-private@example.test',
			'webhook_url' => 'https://hooks.example.test/private-endpoint',
			'webhook_hdr' => 'Bearer-private-header-value',
			'api_key'     => 'private-api-key-value',
			'captcha'     => 'private-captcha-secret',
			'pay_secret'  => 'private-payment-secret',
			'internal'    => 'private-internal-setting',
		);
		$schema  = array(
			'metadata'       => array(
				'type'          => 'regular',
				'title'         => 'Secrets',
				'name'          => 'Secrets',
				'notifications' => array( 'to' => $secrets['notify_to'] ),
				'internal'      => $secrets['internal'],
				'payment'       => array(
					'enabled'   => true,
					'currency'  => 'USD',
					'secretKey' => $secrets['pay_secret'],
					'apiKey'    => $secrets['api_key'],
				),
			),
			'schema_version' => 1,
			'fields'         => array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'c', 'key' => 'cap', 'type' => 'recaptcha', 'label' => 'Captcha', 'site_key' => 'public-site-key', 'secret_key' => $secrets['captcha'], 'config' => array( 'secret_key' => $secrets['captcha'] ) ),
			),
			'actions'        => array(
				array(
					'type'   => 'notification',
					'config' => array( 'to' => $secrets['notify_to'] ),
				),
				array(
					'type'   => 'webhook',
					'config' => array(
						'url'     => $secrets['webhook_url'],
						'headers' => array( 'Authorization' => $secrets['webhook_hdr'] ),
					),
				),
			),
		);
		$repo    = new \SubtleForms\Repositories\FormsRepository();
		$formId  = $repo->create( array( 'title' => 'Secrets', 'status' => 'published', 'schema' => $schema ) );
		$repo->saveSchemaVersion( $formId, $schema, true );
		$this->formIds[] = $formId;

		// The fixture really holds them, so an empty result proves something.
		$stored = (string) wp_json_encode( \SubtleForms\Engine\FormRestrictions::activeSchema( $formId ), JSON_UNESCAPED_SLASHES );
		$this->assertStringContainsString( $secrets['webhook_url'], $stored );
		$this->assertStringContainsString( $secrets['captcha'], $stored );

		$html = $this->shortcode( $formId );
		$this->assertIsArray( $this->printed( $html, $formId ) );
		// JSON escapes slashes, so a URL is also looked for by its host.
		$secrets['webhook_host'] = 'hooks.example.test';
		foreach ( $secrets as $name => $value ) {
			$this->assertStringNotContainsString( $value, $html, "The page must not carry the $name value." );
		}
		// Whatever is added to the payload later, a nonce is not part of it.
		$this->assertStringNotContainsString( 'nonce', strtolower( (string) wp_json_encode( $this->printed( $html, $formId ) ) ) );
		$this->assertArrayNotHasKey( 'actions', $this->printed( $html, $formId )['schema'] );
		$this->assertArrayNotHasKey( 'config', $this->printed( $html, $formId )['form'] );
	}

	public function test_the_tag_cannot_be_closed_by_form_text(): void {
		$label  = "</script><script>alert(1)</script> & 'q' \"x\" \u{2028}";
		$formId = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => $label ) ) );
		$html   = $this->shortcode( $formId );

		$this->assertSame( 1, substr_count( $html, '</script>' ), 'Only the data tag closes a script element.' );
		$this->assertSame( 0, substr_count( strtolower( $html ), '<script>alert' ) );
		$data = $this->printed( $html, $formId );
		$this->assertSame( $label, $data['schema']['fields'][0]['label'] );
		// The outline escapes the same text as HTML.
		$this->assertStringNotContainsString( '<script>alert', $html );
	}

	public function test_no_data_for_people_who_edit_or_when_turned_off(): void {
		$formId = $this->contact();

		$this->asAdmin();
		InlineData::resetForTests();
		$this->assertStringNotContainsString( 'sf-form-data-', $this->shortcode( $formId ) );

		wp_set_current_user( 0 );
		InlineData::resetForTests();
		add_filter( 'subtleforms/frontend/inline_form_data', '__return_false' );
		$html = $this->shortcode( $formId );
		$this->assertStringNotContainsString( 'sf-form-data-', $html );
		$this->assertStringContainsString( 'subtleforms-skeleton', $html, 'The outline does not depend on the data.' );
	}

	public function test_a_subscriber_gets_the_public_data(): void {
		$formId = $this->contact();
		$user   = self::factory_user( 'subscriber' );
		wp_set_current_user( $user );
		$this->assertIsArray( $this->printed( $this->shortcode( $formId ), $formId ) );
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $user );
	}

	public function test_nothing_is_printed_for_unpublished_forms(): void {
		$formId = $this->contact();
		global $wpdb;
		$wpdb->update( $wpdb->prefix . 'subtleforms_forms', array( 'status' => 'draft' ), array( 'id' => $formId ) );
		$this->assertNull( InlineData::payload( $formId ) );
		$this->assertSame( '', InlineData::tag( $formId ) );
		$this->assertNull( InlineData::payload( 0 ) );
	}

	public function test_outline_shows_the_real_labels_without_inputs(): void {
		$formId = $this->publish(
			array(
				array( 'id' => 'a', 'key' => 'first', 'type' => 'text', 'label' => 'First name', 'appearance' => array( 'width' => 50 ) ),
				array( 'id' => 'b', 'key' => 'last', 'type' => 'text', 'label' => 'Last <b>name</b>', 'appearance' => array( 'width' => 50 ) ),
				array( 'id' => 'h', 'key' => 'ref', 'type' => 'hidden', 'label' => 'Hidden' ),
				array( 'id' => 'r', 'key' => 'pick', 'type' => 'radio', 'label' => 'Pick one', 'options' => array( array( 'label' => 'A', 'value' => 'a' ), array( 'label' => 'B', 'value' => 'b' ) ) ),
				array( 'id' => 'm', 'key' => 'msg', 'type' => 'textarea', 'label' => 'Message' ),
			)
		);
		$html = $this->outline( $this->shortcode( $formId ) );

		$this->assertStringContainsString( 'First name', $html );
		$this->assertStringContainsString( 'Last name', $html );
		$this->assertStringNotContainsString( 'Hidden', $html );
		$this->assertStringContainsString( 'subtleforms-skeleton__control--textarea', $html );
		$this->assertSame( 2, substr_count( $html, 'subtleforms-skeleton__control--choice' ) );
		$this->assertStringContainsString( 'flex-basis:calc(50%', $html );
		$this->assertStringContainsString( 'aria-hidden="true"', $html );
		$this->assertStringNotContainsString( '<input', $html );
		$this->assertStringNotContainsString( '<textarea', $html );
	}

	public function test_outline_of_a_multi_step_form_is_the_first_step(): void {
		$formId = $this->publish(
			array(
				array( 'id' => 's1', 'key' => 'step_1', 'type' => 'step', 'label' => 'One', 'children' => array( array( 'id' => 'a', 'key' => 'first', 'type' => 'text', 'label' => 'On step one' ) ) ),
				array( 'id' => 's2', 'key' => 'step_2', 'type' => 'step', 'label' => 'Two', 'children' => array( array( 'id' => 'b', 'key' => 'second', 'type' => 'text', 'label' => 'On step two' ) ) ),
			)
		);
		$html = $this->outline( $this->shortcode( $formId ) );
		$this->assertStringContainsString( 'On step one', $html );
		$this->assertStringNotContainsString( 'On step two', $html );
	}

	public function test_block_respects_the_title_toggle_in_the_outline(): void {
		$formId = $this->contact();
		$shown  = do_blocks( '<!-- wp:subtleforms/form {"formId":' . $formId . '} /-->' );
		InlineData::resetForTests();
		$hidden = do_blocks( '<!-- wp:subtleforms/form {"formId":' . $formId . ',"showTitle":false} /-->' );

		$this->assertStringContainsString( 'subtleforms-skeleton__title', $shown );
		$this->assertStringNotContainsString( 'subtleforms-skeleton__title', $hidden );
	}

	private static function factory_user( string $role ): int {
		return (int) wp_insert_user(
			array(
				'user_login' => 'sf_inline_' . wp_generate_password( 6, false ),
				'user_pass'  => wp_generate_password(),
				'role'       => $role,
			)
		);
	}
}
