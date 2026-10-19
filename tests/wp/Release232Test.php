<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.3.2 server behaviour against a real WordPress (Pro active on the test
 * site, so its templates come through the `subtleforms/templates` filter):
 *
 * - Item 2: POST /forms with any template's schema saves the full form
 *   (every field, the actions and the type); a single checkbox with a list
 *   of options is saved as Multiple choice; a schema that cannot be saved
 *   is refused and leaves no empty form behind.
 * - Item 1: the type follows the structure on every save, and the 2.3.2
 *   upgrade fixes stored forms.
 * - Item 5: custom validation messages and admin labels on the server.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Templates\FormTemplates;

final class Release232Test extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		wp_set_current_user( 1 );
	}

	private function rest( string $method, string $path, array $body = array() ): array {
		$parts   = explode( '?', $path, 2 );
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $parts[0] );
		if ( isset( $parts[1] ) ) {
			parse_str( $parts[1], $query );
			$request->set_query_params( $query );
		}
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		if ( $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		$response = rest_do_request( $request );
		return array(
			'status' => $response->get_status(),
			'data'   => $response->get_data(),
		);
	}

	/** Input leaves of a field tree. */
	private function leaves( array $fields ): array {
		$out = array();
		foreach ( $fields as $f ) {
			if ( ! is_array( $f ) ) {
				continue;
			}
			$children = $f['children'] ?? ( $f['fields'] ?? null );
			if ( is_array( $children ) && $children ) {
				$out = array_merge( $out, $this->leaves( $children ) );
				continue;
			}
			if ( in_array( $f['type'] ?? '', array( 'step', 'html', 'section_break', 'disclaimer' ), true ) ) {
				continue;
			}
			$out[] = $f;
		}
		return $out;
	}

	/** The schema the New form screen sends for a template (utils/templateSchema.js). */
	private function templateSchema( array $tpl ): array {
		$metadata             = $tpl['schema']['metadata'] ?? array();
		$metadata['name']     = 'form_schema';
		$metadata['title']    = $tpl['name'];
		$metadata['template'] = $tpl['id'];
		$schema               = array(
			'schema_version' => 1,
			'metadata'       => $metadata,
			'fields'         => $tpl['schema']['fields'],
		);
		if ( isset( $tpl['schema']['actions'] ) ) {
			$schema['actions'] = $tpl['schema']['actions'];
		}
		return $schema;
	}

	private function track( $res ): int {
		$id = (int) ( $res['data']['data']['id'] ?? 0 );
		if ( $id ) {
			$this->formIds[] = $id;
		}
		return $id;
	}

	public function test_every_template_creates_the_full_form(): void {
		$templates = FormTemplates::get_all();
		$checked   = 0;
		$pro       = 0;
		$repo      = new FormsRepository();
		foreach ( $templates as $key => $tpl ) {
			if ( empty( $tpl['schema']['fields'] ) ) {
				continue; // A locked preview card (Pro not active).
			}
			$expected = count( $this->leaves( $tpl['schema']['fields'] ) );
			$this->assertGreaterThan( 0, $expected, "{$key} has fields" );

			$res = $this->rest( 'POST', '/forms', array( 'title' => $tpl['name'], 'schema' => $this->templateSchema( $tpl ) ) );
			$this->assertSame( 201, $res['status'], "{$key}: " . wp_json_encode( $res['data'] ) );
			$id     = $this->track( $res );
			$schema = $repo->loadSchemaVersion( $id )['schema'] ?? null;
			$this->assertIsArray( $schema, "{$key} saved a schema" );
			$this->assertCount( $expected, $this->leaves( $schema['fields'] ), "{$key} keeps every field" );
			if ( ! empty( $tpl['schema']['actions'] ) ) {
				$this->assertCount( count( $tpl['schema']['actions'] ), $schema['actions'], "{$key} keeps its actions" );
			}
			$type = $tpl['schema']['metadata']['type'] ?? 'regular';
			$this->assertSame( 'conversational' === $type ? 'conversational' : ( 'multi-step' === $type || 'multistep' === $type ? 'multi-step' : 'regular' ), $schema['metadata']['type'], "{$key} type" );
			++$checked;
			if ( ! empty( $tpl['is_pro'] ) ) {
				++$pro;
			}
		}
		$this->assertGreaterThanOrEqual( 12, $checked );
		if ( defined( 'SUBTLEFORMS_PRO_VERSION' ) ) {
			$this->assertGreaterThan( 40, $pro, 'Pro templates were checked' );
		}
	}

	public function test_volunteer_signup_shape_saves_checkbox_lists_as_multiple_choice(): void {
		// The Pro 2.3.2 Volunteer Signup shape: two single checkboxes with lists.
		$schema = array(
			'metadata' => array( 'title' => 'Volunteer', 'template' => 'x_custom' ),
			'fields'   => array(
				array( 'id' => 'full_name', 'type' => 'text', 'label' => 'Full Name', 'required' => true ),
				array(
					'id'       => 'availability',
					'type'     => 'checkbox',
					'label'    => 'Availability',
					'required' => true,
					'options'  => array( array( 'value' => 'am', 'label' => 'Mornings' ), array( 'value' => 'pm', 'label' => 'Evenings' ) ),
				),
				array(
					'id'      => 'skills',
					'type'    => 'checkbox',
					'label'   => 'Skills',
					'options' => array( array( 'value' => 'a', 'label' => 'A' ) ),
				),
				array( 'id' => 'agree', 'type' => 'checkbox', 'label' => 'Agree', 'checkboxLabel' => 'I agree' ),
			),
		);
		$res = $this->rest( 'POST', '/forms', array( 'title' => 'Volunteer', 'schema' => $schema ) );
		$this->assertSame( 201, $res['status'] );
		$saved = ( new FormsRepository() )->loadSchemaVersion( $this->track( $res ) )['schema'];
		$this->assertSame( array( 'text', 'multiple_choice', 'multiple_choice', 'checkbox' ), array_column( $saved['fields'], 'type' ) );
		$this->assertTrue( $saved['fields'][1]['allowMultiple'] );
		$this->assertCount( 2, $saved['fields'][1]['options'] );
		$this->assertTrue( $saved['fields'][1]['required'] );
	}

	public function test_a_schema_that_cannot_be_saved_is_refused_and_leaves_no_form(): void {
		global $wpdb;
		$before = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_forms" );
		$schema = array(
			'metadata' => array( 'title' => 'Broken' ),
			'fields'   => array(
				array( 'id' => 'a', 'key' => 'same', 'type' => 'text', 'label' => 'A' ),
				array( 'id' => 'b', 'key' => 'same', 'type' => 'text', 'label' => 'B' ),
			),
		);
		$res = $this->rest( 'POST', '/forms', array( 'title' => 'Broken', 'schema' => $schema ) );
		$this->track( $res );
		$this->assertSame( 422, $res['status'] );
		$this->assertStringContainsString( 'could not be created', wp_json_encode( $res['data'] ) );
		$this->assertSame( $before, (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_forms" ) );
	}

	// ── Item 1 ───────────────────────────────────────────────────────────

	public function test_saving_a_schema_sets_the_type_from_its_structure(): void {
		$repo = new FormsRepository();
		$id   = $repo->create( array( 'title' => 'Type sync', 'status' => 'draft' ) );
		$this->formIds[] = $id;
		$step = array( 'id' => 's1', 'key' => 's1', 'type' => 'step', 'title' => 'One', 'children' => array( array( 'id' => 'a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$text = array( 'id' => 'b', 'key' => 'b', 'type' => 'text', 'label' => 'B' );

		$repo->saveDraftSchema( $id, array( 'schema_version' => 1, 'metadata' => array( 'name' => 'x', 'type' => 'regular' ), 'fields' => array( $step ) ) );
		$this->assertSame( 'multi-step', $repo->getDraftSchema( $id )['metadata']['type'] );

		$repo->saveSchemaVersion( $id, array( 'schema_version' => 1, 'metadata' => array( 'name' => 'x', 'type' => 'multi-step' ), 'fields' => array( $text ) ), true );
		$this->assertSame( 'regular', $repo->loadSchemaVersion( $id )['schema']['metadata']['type'] );

		$repo->saveDraftSchema( $id, array( 'schema_version' => 1, 'metadata' => array( 'name' => 'x', 'type' => 'conversational' ), 'fields' => array( $step ) ) );
		$this->assertSame( 'conversational', $repo->getDraftSchema( $id )['metadata']['type'] );
	}

	public function test_upgrade_fixes_the_type_of_stored_forms(): void {
		global $wpdb;
		$repo = new FormsRepository();
		$id   = $repo->create( array( 'title' => 'Legacy type', 'status' => 'published' ) );
		$this->formIds[] = $id;
		$legacy = array(
			'schema_version' => 1,
			'metadata'       => array( 'name' => 'x', 'type' => 'regular' ),
			'fields'         => array( array( 'id' => 's1', 'key' => 's1', 'type' => 'step', 'children' => array() ) ),
		);
		// Written the way builds before 2.3.2 stored it (no type sync).
		$wpdb->insert( $wpdb->prefix . 'subtleforms_form_schemas', array( 'form_id' => $id, 'version' => 1, 'schema_data' => wp_json_encode( $legacy ), 'active' => 1 ) );
		$wpdb->update( $wpdb->prefix . 'subtleforms_forms', array( 'config' => wp_json_encode( $legacy ), 'draft_schema' => wp_json_encode( $legacy ) ), array( 'id' => $id ) );
		wp_cache_flush();

		$this->assertGreaterThanOrEqual( 3, \SubtleForms\Activator::migrate_form_types() );
		wp_cache_flush();
		$this->assertSame( 'multi-step', $repo->getDraftSchema( $id )['metadata']['type'] );
		$this->assertSame( 'multi-step', $repo->loadSchemaVersion( $id )['schema']['metadata']['type'] );
		$row = $this->rest( 'GET', "/forms/{$id}" );
		$this->assertSame( 'multi-step', $row['data']['data']['type'] );
		// Running it again changes nothing.
		$this->assertSame( 0, \SubtleForms\Activator::migrate_form_types() );
	}

	// ── Item 5 ───────────────────────────────────────────────────────────

	private function settingsForm(): int {
		return $this->publish(
			array(
				array( 'id' => 'e', 'key' => 'email', 'type' => 'email', 'label' => 'Your email', 'adminLabel' => 'Contact email', 'required' => true, 'requiredMessage' => 'We need your email.', 'validationMessage' => 'Not an email address.' ),
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name', 'labelVisibility' => 'hidden', 'descriptionPlacement' => 'above' ),
			)
		);
	}

	public function test_server_refuses_with_the_fields_own_messages(): void {
		$id  = $this->settingsForm();
		$res = $this->submit( $id, array( 'name' => 'Ada' ) );
		$this->assertSame( 'We need your email.', $this->findError( $res, 'email' ) );
		$res = $this->submit( $id, array( 'name' => 'Ada', 'email' => 'nope' ) );
		$this->assertSame( 'Not an email address.', $this->findError( $res, 'email' ) );
	}

	private function findError( array $res, string $key ): ?string {
		$found = null;
		array_walk_recursive(
			$res['data'],
			function ( $value, $k ) use ( $key, &$found ) {
				if ( $k === $key && is_string( $value ) && null === $found ) {
					$found = $value;
				}
			}
		);
		return $found;
	}

	public function test_admin_label_in_email_and_csv_export(): void {
		$id = $this->settingsForm();
		$this->assertSame( 200, $this->submit( $id, array( 'name' => 'Ada', 'email' => 'ada@example.com' ) )['status'] );

		// {all_fields} in a notification.
		$jobs    = array();
		$capture = function ( $pre, $event ) use ( &$jobs ) {
			if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
				$jobs[] = $event->args[0];
				return true;
			}
			return $pre;
		};
		add_filter( 'pre_schedule_event', $capture, 10, 2 );
		$schema  = ( new FormsRepository() )->loadSchemaVersion( $id )['schema'];
		$context = new \SubtleForms\Engine\SubmissionContext( $id, array( 'name' => 'Ada', 'email' => 'ada@example.com' ) );
		$context->setMeta( 'form_schema', $schema );
		$context->setMeta( 'submission_id', 0 );
		$context->setMeta( 'current_step_settings', array( 'to' => 'owner@example.com', 'subject' => 'S', 'message' => '{all_fields}', 'format' => 'text' ) );
		( new \SubtleForms\Engine\Actions\EmailAction() )->handle( $context );
		remove_filter( 'pre_schedule_event', $capture, 10 );
		$this->assertStringContainsString( 'Contact email: ada@example.com', $jobs[0]['body'] );
		$this->assertStringNotContainsString( 'Your email', $jobs[0]['body'] );

		// CSV export headings.
		$caps    = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		$api     = new \SubtleForms\Api\SubmissionsApi( new FormsRepository(), new \SubtleForms\Repositories\SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $id ) ) );
		$csv = base64_decode( $api->export_submissions_csv( $request )->get_data()['data']['csv'] );
		$this->assertStringContainsString( 'Contact email', $csv );
		$this->assertStringNotContainsString( 'Your email', $csv );
	}

	public function test_public_schema_carries_field_settings_and_form_defaults(): void {
		$repo = new FormsRepository();
		$id   = $this->settingsForm();
		$schema = $repo->loadSchemaVersion( $id )['schema'];
		$schema['metadata'] += array( 'labelVisibility' => 'hidden', 'descriptionPlacement' => 'above', 'requiredMessage' => 'Answer please.' );
		$repo->saveSchemaVersion( $id, $schema, true );
		wp_set_current_user( 0 );
		$res = $this->rest( 'GET', "/forms/{$id}/schema" );
		$this->assertSame( 200, $res['status'] );
		$public = $res['data']['data']['schema'] ?? $res['data']['data'];
		$this->assertSame( 'hidden', $public['metadata']['labelVisibility'] );
		$this->assertSame( 'above', $public['metadata']['descriptionPlacement'] );
		$this->assertSame( 'Answer please.', $public['metadata']['requiredMessage'] );
		$byKey = array_column( $public['fields'], null, 'key' );
		$this->assertSame( 'hidden', $byKey['name']['labelVisibility'] );
		$this->assertSame( 'above', $byKey['name']['descriptionPlacement'] );
	}

	public function test_form_metadata_defaults_are_kept_when_saved_through_the_api(): void {
		$res = $this->rest( 'POST', '/forms', array( 'title' => 'Defaults' ) );
		$id  = $this->track( $res );
		$save = $this->rest(
			'POST',
			"/forms/{$id}/schema",
			array(
				'activate' => true,
				'schema'   => array(
					'schema_version' => 1,
					'metadata'       => array( 'name' => 'x', 'title' => 'Defaults', 'type' => 'regular', 'labelVisibility' => 'hidden', 'descriptionPlacement' => 'above', 'requiredMessage' => 'Please answer.', 'validationMessage' => 'Please check.' ),
					'fields'         => array( array( 'id' => 'a', 'key' => 'a', 'type' => 'text', 'label' => 'A', 'adminLabel' => 'Admin A', 'labelVisibility' => 'visible', 'validationMessage' => 'Own.' ) ),
				),
			)
		);
		$this->assertLessThan( 300, $save['status'], wp_json_encode( $save['data'] ) );
		$stored = ( new FormsRepository() )->loadSchemaVersion( $id )['schema'];
		$this->assertSame( 'hidden', $stored['metadata']['labelVisibility'] );
		$this->assertSame( 'above', $stored['metadata']['descriptionPlacement'] );
		$this->assertSame( 'Please answer.', $stored['metadata']['requiredMessage'] );
		$this->assertSame( 'Please check.', $stored['metadata']['validationMessage'] );
		$this->assertSame( 'Admin A', $stored['fields'][0]['adminLabel'] );
		$this->assertSame( 'Own.', $stored['fields'][0]['validationMessage'] );
	}
}
