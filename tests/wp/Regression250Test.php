<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Regression tests for fixes that shipped before 2.5.0 without one:
 * FA-14 (Action Hook fires), WP2-02 (analytics in the free plugin),
 * FF-02 and WP2-08 (AI assistant keys are gone) and FF2-12 (theme fonts
 * in the builder preview).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Support\Settings;

final class Regression250Test extends TestCase {

	/** @var array<int, array<string, mixed>> */
	private $fired = array();

	protected function tearDown(): void {
		remove_all_actions( 'qa_adv_hook' );
		delete_option( Settings::OPTION_NAME );
		parent::tearDown();
	}

	private function actionHookForm(): int {
		return $this->publish(
			array(
				array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'f2', 'key' => 'hook', 'type' => 'action_hook', 'label' => 'Hook', 'hook_name' => 'QA_Adv_Hook' ),
			)
		);
	}

	private function listen(): void {
		$this->fired = array();
		add_action(
			'qa_adv_hook',
			function ( $context ) {
				$this->fired[] = (array) $context;
			}
		);
	}

	/** FA-14: the hook named on the field runs when the form is shown. */
	public function test_action_hook_fires_when_the_form_renders(): void {
		$formId = $this->actionHookForm();
		$this->listen();

		wp_set_current_user( 0 );
		$response = rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $formId . '/schema' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertCount( 1, $this->fired, 'The hook ran once for one render.' );
		$this->assertSame( 'render', $this->fired[0]['when'] );
	}

	/** FA-14: and when the form is submitted, with the form id and the answers. */
	public function test_action_hook_fires_when_the_form_is_submitted(): void {
		$formId = $this->actionHookForm();
		$this->listen();

		$result = $this->submit( $formId, array( 'name' => 'Ada' ) );

		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$submits = array_values( array_filter( $this->fired, static fn( $c ) => 'submit' === ( $c['when'] ?? '' ) ) );
		$this->assertCount( 1, $submits );
		$this->assertSame( $formId, (int) $submits[0]['form_id'] );
		$this->assertSame( 'Ada', $submits[0]['payload']['name'] );
	}

	/** FA-14: a form without an Action Hook field fires nothing. */
	public function test_a_form_without_the_field_fires_nothing(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->listen();
		$this->submit( $formId, array( 'name' => 'Ada' ) );
		$this->assertSame( array(), $this->fired );
	}

	/** FF-02, WP2-08: stored AI assistant keys are removed, other settings stay. */
	public function test_stored_ai_keys_are_removed_and_other_settings_stay(): void {
		update_option(
			Settings::OPTION_NAME,
			array(
				'ai_api_key'  => 'not-a-real-key',
				'ai_enabled'  => true,
				'sender_name' => 'Acme',
			)
		);
		update_option( 'subtleforms_ai_usage', 'x' );

		Settings::remove_ai_options();
		wp_cache_flush();

		$stored = get_option( Settings::OPTION_NAME );
		$this->assertArrayNotHasKey( 'ai_api_key', $stored );
		$this->assertArrayNotHasKey( 'ai_enabled', $stored );
		$this->assertSame( 'Acme', $stored['sender_name'] );
		$this->assertFalse( get_option( 'subtleforms_ai_usage', false ) );
	}

	/** FF-02, WP2-08: the settings defaults hold no AI key. */
	public function test_settings_defaults_have_no_ai_keys(): void {
		foreach ( array_keys( ( new Settings() )->getAll() ) as $key ) {
			$this->assertStringStartsNotWith( 'ai_', (string) $key );
		}
	}

	/** FF2-12: the builder preview always gets the theme font faces as a string, never a fatal. */
	public function test_theme_font_faces_is_a_string(): void {
		$this->assertIsString( AdminMenu::themeFontFaces() );
	}
}
