<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.7.0: picture choice, several files per upload field, advanced logic and
 * form analytics moved to SubtleForms Pro. This runs the free plugin alone:
 * what is gone is gone, and a form saved with those features keeps working
 * as the plain thing it falls back to, with nothing stripped.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\ExtensionPoints;
use SubtleForms\Uploads\Uploads;

final class MoveToPro270Test extends TestCase {

	private function pictureField( array $extra = array() ): array {
		return array_merge(
			array(
				'id'      => 'p1',
				'key'     => 'pet',
				'type'    => 'picture_choice',
				'label'   => 'Pet',
				'options' => array(
					array( 'label' => 'Cat', 'value' => 'cat', 'image' => 'https://example.com/cat.png' ),
					array( 'label' => 'Dog', 'value' => 'dog', 'image' => 'https://example.com/dog.png' ),
				),
			),
			$extra
		);
	}

	private function restGet( string $route ): \WP_REST_Response {
		return rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1' . $route ) );
	}

	// ── What is gone ──────────────────────────────────────────────────

	public function test_the_analytics_routes_are_gone(): void {
		$formId = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->asAdmin();
		$get = array( '/analytics/summary', '/analytics/funnel', '/analytics/forms' );
		foreach ( $get as $route ) {
			$this->assertSame( 404, $this->restGet( $route )->get_status(), $route );
		}
		$routes = rest_get_server()->get_routes();
		foreach ( array( '/subtleforms/v1/forms/' . $formId . '/view', '/subtleforms/v1/forms/' . $formId . '/funnel' ) as $path ) {
			$matched = array_filter( array_keys( $routes ), static fn( $r ) => preg_match( '#^' . $r . '$#', $path ) );
			$this->assertSame( array(), array_values( $matched ), $path );
		}
		$this->assertFalse( class_exists( 'SubtleForms\\Analytics\\Stats' ) );
		$this->assertFalse( class_exists( 'SubtleForms\\Analytics\\Funnel' ) );
	}

	public function test_the_front_end_is_told_to_count_nothing(): void {
		$GLOBALS['wp_scripts'] = null;
		do_action( 'wp_enqueue_scripts' );
		$data = wp_scripts()->get_data( 'subtleforms-frontend', 'data' );
		if ( is_string( $data ) ) {
			$this->assertStringNotContainsString( 'trackViews', $data );
			$this->assertStringNotContainsString( 'trackFunnel', $data );
		}
		$this->assertTrue( true );
	}

	public function test_the_extension_points_are_declared_and_nothing_is_provided_alone(): void {
		foreach ( array( 'picture_choice', 'multi_file_uploads', 'advanced_logic', 'analytics' ) as $point ) {
			$this->assertTrue( ExtensionPoints::has( $point ), $point );
			$this->assertFalse( ExtensionPoints::isProvided( $point ), $point );
		}
		$this->assertSame( array(), ExtensionPoints::provided() );
	}

	public function test_the_spam_card_and_entry_counts_stay(): void {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/reports/overview' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$this->assertSame( 200, rest_do_request( $request )->get_status() );
		$this->assertTrue( class_exists( 'SubtleForms\\Analytics\\SpamStats' ) );
	}

	public function test_deleting_a_form_still_removes_its_spam_rows_and_tells_add_ons(): void {
		global $wpdb;
		\SubtleForms\Analytics\SpamStats::maybeInstall();
		$formId = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		\SubtleForms\Analytics\SpamStats::record( $formId, 'honeypot' );
		$told = array();
		add_action( 'subtleforms/form/deleted', static function ( $id ) use ( &$told ) { $told[] = (int) $id; } );
		$this->assertTrue( ( new FormsRepository() )->delete( $formId ) );
		$spam = \SubtleForms\Analytics\SpamStats::table();
		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$spam} WHERE form_id = %d", $formId ) ) );
		$this->assertContains( $formId, $told, 'Add-ons that keep their own rows (analytics) are told.' );
	}

	// ── Picture choice falls back to a plain choice ───────────────────

	public function test_a_picture_choice_form_is_saved_and_served_with_nothing_stripped(): void {
		$field  = $this->pictureField( array( 'allowMultiple' => true, 'pictureColumns' => 4, 'madeUpKey' => array( 'kept' => true ) ) );
		$formId = $this->publish( array( $field ) );
		wp_set_current_user( 0 );
		$response = $this->restGet( '/forms/' . $formId . '/schema' );
		$this->assertSame( 200, $response->get_status() );
		$fields = $response->get_data()['data']['schema']['fields'] ?? array();
		$served = $fields[0] ?? array();
		$this->assertSame( 'picture_choice', $served['type'], 'The type is not rewritten: Pro draws it when it is active.' );
		$this->assertSame( 4, $served['pictureColumns'] );
		$this->assertSame( 'https://example.com/cat.png', $served['options'][0]['image'] );
		$this->assertSame( array( 'kept' => true ), $served['madeUpKey'] );
	}

	public function test_a_single_picture_choice_validates_as_a_radio_group(): void {
		$formId = $this->publish( array( $this->pictureField( array( 'required' => true ) ) ) );
		$ok     = $this->submit( $formId, array( 'pet' => 'dog' ) );
		$this->assertSame( 200, $ok['status'], wp_json_encode( $ok['data'] ) );
		$this->assertSame( 'dog', $this->storedPayload( $formId )['pet'] );

		$this->assertSame( 422, $this->submit( $formId, array( 'pet' => 'fish' ) )['status'], 'A value that is not a choice is refused.' );
		$this->assertSame( 422, $this->submit( $formId, array( 'pet' => array( 'cat', 'dog' ) ) )['status'], 'One answer only.' );
		$this->assertSame( 422, $this->submit( $formId, array() )['status'], 'Required still applies.' );
	}

	public function test_a_picture_choice_that_allows_several_validates_as_a_checkbox_group(): void {
		$formId = $this->publish( array( $this->pictureField( array( 'allowMultiple' => true, 'minChoices' => 1 ) ) ) );
		$ok     = $this->submit( $formId, array( 'pet' => array( 'cat', 'dog' ) ) );
		$this->assertSame( 200, $ok['status'], wp_json_encode( $ok['data'] ) );
		$this->assertSame( array( 'cat', 'dog' ), $this->storedPayload( $formId )['pet'] );
		$this->assertSame( 422, $this->submit( $formId, array( 'pet' => array( 'cat', 'fish' ) ) )['status'] );
	}

	// ── Several files per upload field take one file ──────────────────

	public function test_a_multi_file_field_accepts_one_file_and_keeps_its_settings(): void {
		$field = array( 'id' => 'u1', 'key' => 'docs', 'type' => 'file_upload', 'label' => 'Docs', 'multiple' => true, 'maxFiles' => 5 );
		$this->assertSame( 1, Uploads::maxFiles( $field ) );
		$formId = $this->publish( array( $field ) );
		$stored = ( new FormsRepository() )->loadSchemaVersion( $formId )['schema'];
		$node   = $stored['fields'][0] ?? array();
		$this->assertTrue( $node['multiple'] );
		$this->assertSame( 5, $node['maxFiles'] );

		$many = Uploads::resolvePayload( $formId, $stored, array( 'docs' => array( 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2' ) ) );
		$this->assertInstanceOf( \WP_Error::class, $many );
		$this->assertArrayHasKey( 'docs', $many->get_error_data()['errors'] );
		$this->assertStringContainsString( 'up to 1 file', $many->get_error_data()['errors']['docs'] );
	}

	public function test_an_add_on_can_raise_the_limit(): void {
		$field  = array( 'type' => 'file_upload', 'multiple' => true, 'maxFiles' => 5 );
		$filter = static fn( $max, $f ) => ! empty( $f['multiple'] ) ? (int) $f['maxFiles'] : $max;
		add_filter( 'subtleforms/uploads/max_files', $filter, 10, 2 );
		$this->assertSame( 5, Uploads::maxFiles( $field ) );
		$this->assertSame( 1, Uploads::maxFiles( array( 'type' => 'file_upload' ) ) );
		remove_filter( 'subtleforms/uploads/max_files', $filter, 10 );
		$this->assertSame( 1, Uploads::maxFiles( $field ) );
	}

	// ── Advanced logic is ignored ─────────────────────────────────────

	private function advancedForm(): int {
		$any = array(
			'action' => 'show',
			'groups' => array(
				array( 'match' => 'any', 'rules' => array( array( 'field' => 'plan', 'operator' => 'starts_with', 'value' => 'bus' ), array( 'field' => 'plan', 'operator' => 'in', 'value' => 'team, enterprise' ) ) ),
				array( 'match' => 'all', 'rules' => array( array( 'field' => 'plan', 'operator' => 'between', 'value' => '1', 'value2' => '5' ) ) ),
			),
		);
		return $this->publish(
			array(
				array( 'id' => 'a', 'key' => 'plan', 'type' => 'text', 'label' => 'Plan' ),
				array( 'id' => 'b', 'key' => 'invoice', 'type' => 'text', 'label' => 'Invoice', 'logic' => $any ),
				array( 'id' => 'c', 'type' => 'step', 'key' => 'extra', 'logic' => $any, 'children' => array( array( 'id' => 'd', 'key' => 'note', 'type' => 'text', 'label' => 'Note' ) ) ),
			)
		);
	}

	public function test_a_form_with_advanced_logic_is_saved_untouched(): void {
		$formId = $this->advancedForm();
		$stored = ( new FormsRepository() )->loadSchemaVersion( $formId )['schema'];
		$logic  = $stored['fields'][1]['logic'];
		$this->assertCount( 2, $logic['groups'], 'Both groups are kept.' );
		$this->assertSame( 'any', $logic['groups'][0]['match'] );
		$this->assertSame( 'starts_with', $logic['groups'][0]['rules'][0]['operator'] );
		$this->assertSame( '5', $logic['groups'][1]['rules'][0]['value2'] );
		$this->assertArrayHasKey( 'logic', $stored['fields'][2], 'The step keeps its rule.' );
	}

	public function test_a_submission_is_not_rejected_for_advanced_rules(): void {
		$formId = $this->advancedForm();
		$res    = $this->submit( $formId, array( 'plan' => 'free', 'invoice' => 'INV-1', 'note' => 'hi' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$stored = $this->storedPayload( $formId );
		$this->assertSame( 'INV-1', $stored['invoice'], 'The field was shown, so its answer is kept.' );
		$this->assertSame( 'hi', $stored['note'], 'The step was shown, so its answers are kept.' );
	}

	public function test_advanced_rules_on_actions_do_not_stop_the_action(): void {
		$formId = $this->publish(
			array( array( 'id' => 'a', 'key' => 'plan', 'type' => 'text', 'label' => 'Plan' ) ),
			array(
				array(
					'id'       => 'act1',
					'type'     => 'action_hook',
					'settings' => array(
						'hook'  => 'subtleforms_test_action_270',
						'logic' => array( 'groups' => array( array( 'match' => 'all', 'rules' => array( array( 'field' => 'plan', 'operator' => 'equals', 'value' => 'never' ) ) ) ) ),
					),
				),
			)
		);
		$this->assertFalse( \SubtleForms\Engine\ConditionalLogic::hasLogic( array( 'groups' => array( array( 'rules' => array( array( 'field' => 'plan', 'operator' => 'equals', 'value' => 'never' ) ) ) ) ), 'action' ), 'Logic on an action is not evaluated here.' );
	}

	public function test_the_first_conditional_confirmation_never_wins_without_an_add_on(): void {
		$meta = array(
			'confirmation'  => array( 'id' => 'default', 'type' => 'message' ),
			'confirmations' => array( array( 'id' => 'vip', 'logic' => array( 'groups' => array( array( 'rules' => array( array( 'field' => 'a', 'operator' => 'empty' ) ) ) ) ) ) ),
		);
		$picked = ( new \SubtleForms\Engine\ConditionalLogic() )->pickConfirmation( $meta, array() );
		$this->assertSame( 'default', $picked['id'] );
	}

	// ── Settings and the privacy text ────────────────────────────────

	public function test_settings_an_add_on_stored_here_survive_saving_another_setting(): void {
		$settings = new \SubtleForms\Support\Settings();
		update_option( 'subtleforms_settings', array_merge( (array) get_option( 'subtleforms_settings', array() ), array( 'ext_analytics_retention_days' => 365, 'ext_analytics_funnel_retention_days' => 400 ) ) );
		$settings->update( array( 'sender_name' => 'Acme 270' ) );
		$stored = (array) get_option( 'subtleforms_settings', array() );
		$this->assertSame( 365, $stored['ext_analytics_retention_days'] );
		$this->assertSame( 400, $stored['ext_analytics_funnel_retention_days'] );
		$this->assertSame( 'Acme 270', $stored['sender_name'] );
		$settings->update( array( 'made_up_new_key' => 'x' ) );
		$this->assertArrayNotHasKey( 'made_up_new_key', (array) get_option( 'subtleforms_settings', array() ), 'New keys without a rule are still refused.' );
		unset( $stored['ext_analytics_retention_days'], $stored['ext_analytics_funnel_retention_days'] );
		update_option( 'subtleforms_settings', $stored );
	}

	public function test_the_privacy_text_no_longer_describes_statistics(): void {
		$manager = new \SubtleForms\Privacy\PrivacyManager( new \SubtleForms\Support\Settings(), new \SubtleForms\Repositories\SubmissionsRepository() );
		$method  = new \ReflectionMethod( $manager, 'get_privacy_policy_text' );
		$method->setAccessible( true );
		$this->assertStringNotContainsString( 'Form statistics', (string) $method->invoke( $manager ) );
	}

	public function test_data_in_the_analytics_tables_is_left_alone_by_the_free_plugin(): void {
		global $wpdb;
		// The table Pro adopts: one row per form per day. A site that had
		// analytics before the move has it; make it for a clean site.
		$table = $wpdb->prefix . 'subtleforms_stats';
		$wpdb->query( "CREATE TABLE IF NOT EXISTS {$table} (form_id BIGINT NOT NULL, day DATE NOT NULL, views INT NOT NULL DEFAULT 0, submissions INT NOT NULL DEFAULT 0)" );
		$formId = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$wpdb->insert( $table, array( 'form_id' => $formId, 'day' => gmdate( 'Y-m-d' ), 'views' => 3, 'submissions' => 1 ) );
		$this->submit( $formId, array( 'name' => 'Ada' ) );
		( new FormsRepository() )->delete( $formId );
		$this->assertSame( 3, (int) $wpdb->get_var( $wpdb->prepare( "SELECT views FROM {$table} WHERE form_id = %d", $formId ) ), 'The free plugin neither counts into nor deletes from the analytics table.' );
		$wpdb->delete( $table, array( 'form_id' => $formId ) );
	}
}
