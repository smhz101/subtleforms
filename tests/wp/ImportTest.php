<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * One-click import from Contact Form 7, Gravity Forms and Fluent Forms, end
 * to end on a real site: the source data is put where each plugin keeps it
 * (the plugins themselves are not installed), then imported through REST.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

require_once dirname( __DIR__ ) . '/fixtures/import/Seeder.php';

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Tests\Fixtures\ImportSeeder;

final class ImportTest extends TestCase {

	/** @var array{cf7: int[], gravity: int[], fluent: int[]} */
	private $seeded;

	/** @var int Emails WordPress tried to send. */
	private $mails = 0;

	/** @var callable */
	private $mailCatcher;

	protected function setUp(): void {
		parent::setUp();
		ImportSeeder::clean();
		$this->seeded      = ImportSeeder::seed();
		$this->mails       = 0;
		$this->mailCatcher = function () {
			++$this->mails;
			return true;
		};
		add_filter( 'pre_wp_mail', $this->mailCatcher );
		$this->asAdmin();
	}

	protected function tearDown(): void {
		remove_filter( 'pre_wp_mail', $this->mailCatcher );
		ImportSeeder::clean();
		parent::tearDown();
	}

	/**
	 * @param string $method Method.
	 * @param string $route  Route under subtleforms/v1.
	 * @param array  $body   JSON body.
	 * @return \WP_REST_Response
	 */
	private function rest( string $method, string $route, array $body = array() ): \WP_REST_Response {
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $route );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		if ( $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		return rest_do_request( $request );
	}

	/**
	 * Import and remember the new forms for cleanup.
	 *
	 * @param string $source Source.
	 * @param array  $ids    Ids.
	 * @param array  $copies Ids to import again.
	 * @return array Results.
	 */
	private function import( string $source, array $ids, array $copies = array() ): array {
		$response = $this->rest( 'POST', "/tools/migrate/sources/{$source}/import", array( 'ids' => array_map( 'strval', $ids ), 'copies' => array_map( 'strval', $copies ) ) );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$results = $response->get_data()['data'];
		foreach ( $results as $result ) {
			if ( ! empty( $result['form_id'] ) ) {
				$this->formIds[] = (int) $result['form_id'];
			}
		}
		return $results;
	}

	/** A fingerprint of everything the source plugins store. */
	private function sourceSnapshot(): string {
		global $wpdb;
		$parts = array();
		foreach ( $this->seeded['cf7'] as $id ) {
			$parts[] = wp_json_encode( get_post( $id, ARRAY_A ) );
			$parts[] = wp_json_encode( get_post_meta( $id ) );
		}
		foreach ( array( 'gf_form', 'gf_form_meta', 'fluentform_forms', 'fluentform_form_meta' ) as $table ) {
			$parts[] = wp_json_encode( $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}{$table}", ARRAY_A ) );
		}
		return md5( implode( '|', $parts ) );
	}

	public function test_detects_each_plugin_with_its_form_count(): void {
		$response = $this->rest( 'GET', '/tools/migrate/sources' );
		$this->assertSame( 200, $response->get_status() );
		$sources = array_column( $response->get_data()['data'], null, 'id' );
		$this->assertSame( array( 'cf7', 'gravity', 'fluent' ), array_keys( $sources ) );
		$this->assertGreaterThanOrEqual( 2, $sources['cf7']['count'] );
		$this->assertGreaterThanOrEqual( 1, $sources['gravity']['count'] );
		$this->assertGreaterThanOrEqual( 1, $sources['fluent']['count'] );
		$this->assertSame( 'Contact Form 7', $sources['cf7']['label'] );
		$this->assertFalse( $sources['gravity']['active'], 'The plugin is not installed; its data is still found.' );
	}

	public function test_lists_forms_with_field_counts(): void {
		$response = $this->rest( 'GET', '/tools/migrate/sources/cf7/forms' );
		$this->assertSame( 200, $response->get_status() );
		$forms = array_column( $response->get_data()['data'], null, 'id' );
		$id    = (string) $this->seeded['cf7'][0];
		$this->assertSame( 'Contact form 1', $forms[ $id ]['title'] );
		$this->assertSame( 4, $forms[ $id ]['fields'] );
		$this->assertSame( 0, $forms[ $id ]['notes'], 'The default form copies across with nothing to report (Reply-To included).' );
		$this->assertSame( array(), $forms[ $id ]['imported'] );
	}

	public function test_imports_a_contact_form_7_form_as_a_draft_without_touching_the_original(): void {
		$before  = $this->sourceSnapshot();
		$results = $this->import( 'cf7', array( $this->seeded['cf7'][0] ) );

		$this->assertSame( $before, $this->sourceSnapshot(), 'The original form is not changed.' );
		$this->assertSame( 0, $this->mails, 'No email is sent during an import.' );
		$this->assertSame( 'imported', $results[0]['status'] );
		$this->assertSame( 4, $results[0]['fields'] );
		$this->assertStringContainsString( 'form_id=' . $results[0]['form_id'], $results[0]['edit_url'] );
		$this->assertSame( array( 'info' ), array_column( $results[0]['notes'], 'level' ) );

		$repo = new FormsRepository();
		$form = $repo->find( (int) $results[0]['form_id'] );
		$this->assertSame( 'draft', $form['status'] );
		$this->assertSame( 'Contact form 1', $form['title'] );
		$schema = $repo->loadSchemaVersion( (int) $results[0]['form_id'] )['schema'];
		$this->assertSame( array( 'your-name', 'your-email', 'your-subject', 'your-message' ), array_column( $schema['fields'], 'key' ) );
		$this->assertSame( 'cf7:' . $this->seeded['cf7'][0], $schema['metadata']['importRef'] );
		$this->assertSame( 'cf7', $schema['metadata']['importedFrom']['plugin'] );
		$this->assertSame( '{site_name} "{field:your-subject}"', $schema['actions'][0]['settings']['subject'] );
		$this->assertSame( 'Thank you for your message. It has been sent.', $schema['metadata']['confirmation']['message'] );
		$this->assertStringContainsString( wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ), $schema['actions'][0]['settings']['headers'][0] );
	}

	public function test_importing_again_asks_first_then_makes_a_copy(): void {
		$id    = $this->seeded['cf7'][1];
		$first = $this->import( 'cf7', array( $id ) );
		$this->assertSame( 'imported', $first[0]['status'] );

		$listed = array_column( $this->rest( 'GET', '/tools/migrate/sources/cf7/forms' )->get_data()['data'], null, 'id' );
		$this->assertSame( (int) $first[0]['form_id'], $listed[ (string) $id ]['imported'][0]['id'] );

		$again = $this->import( 'cf7', array( $id ) );
		$this->assertSame( 'exists', $again[0]['status'] );
		$this->assertSame( 0, $again[0]['form_id'], 'Nothing is created without asking.' );
		$this->assertSame( (int) $first[0]['form_id'], $again[0]['existing'][0]['id'] );

		$copy = $this->import( 'cf7', array( $id ), array( $id ) );
		$this->assertSame( 'imported', $copy[0]['status'] );
		$this->assertSame( 'Book a visit (copy)', $copy[0]['title'] );
		$this->assertNotSame( $first[0]['form_id'], $copy[0]['form_id'] );

		// A form moved to the Trash no longer counts as imported.
		$repo = new FormsRepository();
		$repo->trash( (int) $first[0]['form_id'] );
		$repo->trash( (int) $copy[0]['form_id'] );
		$this->assertSame( 'imported', $this->import( 'cf7', array( $id ) )[0]['status'] );
	}

	public function test_imports_gravity_forms_and_fluent_forms_from_their_tables(): void {
		$before = $this->sourceSnapshot();
		$gf     = $this->import( 'gravity', $this->seeded['gravity'] );
		$ff     = $this->import( 'fluent', $this->seeded['fluent'] );
		$this->assertSame( $before, $this->sourceSnapshot() );
		$this->assertSame( 0, $this->mails );

		$repo = new FormsRepository();
		$this->assertSame( 'imported', $gf[0]['status'] );
		$schema = $repo->loadSchemaVersion( (int) $gf[0]['form_id'] )['schema'];
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$this->assertSame( array( 'About you', 'Your application' ), array_column( $schema['fields'], 'title' ) );
		$this->assertSame( 'name_group', $schema['fields'][0]['children'][0]['type'] );
		$this->assertCount( 3, $schema['actions'] );
		$this->assertFalse( $schema['actions'][2]['enabled'] );
		$this->assertSame( 'Job application', $repo->find( (int) $gf[0]['form_id'] )['title'] );
		$this->assertStringContainsString( 'payments are not imported', wp_json_encode( $gf[0]['notes'] ) );

		$this->assertSame( 'imported', $ff[0]['status'] );
		$schema = $repo->loadSchemaVersion( (int) $ff[0]['form_id'] )['schema'];
		$this->assertSame( array( 'Your details', 'Your visit' ), array_column( $schema['fields'], 'title' ) );
		$this->assertSame( 'Book now', $schema['metadata']['submitText'] );
		$this->assertSame( 'draft', $repo->find( (int) $ff[0]['form_id'] )['status'] );
	}

	public function test_an_imported_contact_form_7_mail_replies_to_the_sender(): void {
		$results = $this->import( 'cf7', array( $this->seeded['cf7'][0] ) );
		$formId  = (int) $results[0]['form_id'];
		$this->assertSame( 'imported', $results[0]['status'] );
		( new FormsRepository() )->update( $formId, array( 'status' => 'published' ) );

		$jobs    = array();
		$capture = static function ( $pre, $event ) use ( &$jobs ) {
			if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
				$jobs[] = $event->args[0];
				return true;
			}
			return $pre;
		};
		add_filter( 'pre_schedule_event', $capture, 10, 2 );
		$sent = $this->submit(
			$formId,
			array(
				'your-name'    => 'Ada',
				'your-email'   => 'ada@example.com',
				'your-subject' => 'Hello',
				'your-message' => 'Hi there',
			)
		);
		remove_filter( 'pre_schedule_event', $capture, 10 );
		$this->assertLessThan( 300, $sent['status'], wp_json_encode( $sent['data'] ) );
		$this->assertCount( 1, $jobs, 'The imported Mail is queued.' );

		// Send it, caught before it leaves the site.
		$mails = array();
		$catch = static function ( $short, $atts ) use ( &$mails ) {
			$mails[] = $atts;
			return true;
		};
		remove_filter( 'pre_wp_mail', $this->mailCatcher );
		add_filter( 'pre_wp_mail', $catch, 10, 2 );
		\SubtleForms\Async\AsyncDispatcher::executeEmail( $jobs[0] );
		remove_filter( 'pre_wp_mail', $catch, 10 );
		add_filter( 'pre_wp_mail', $this->mailCatcher );

		$this->assertCount( 1, $mails );
		$headers = implode( "\n", (array) $mails[0]['headers'] );
		$this->assertStringContainsString( 'Reply-To: ada@example.com', $headers );
		$this->assertStringNotContainsString( '{field:', $headers );
		$this->assertSame( get_option( 'admin_email' ), is_array( $mails[0]['to'] ) ? implode( ',', $mails[0]['to'] ) : $mails[0]['to'] );
		$this->assertStringContainsString( '"Hello"', $mails[0]['subject'] );
	}

	public function test_an_answer_that_is_not_one_address_never_becomes_a_header(): void {
		$jobs    = array();
		$capture = static function ( $pre, $event ) use ( &$jobs ) {
			if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
				$jobs[] = $event->args[0];
				return true;
			}
			return $pre;
		};
		add_filter( 'pre_schedule_event', $capture, 10, 2 );
		foreach ( array( "a@b.com\r\nBcc: x@y.com", 'a@b.com, c@d.com', '' ) as $answer ) {
			$context = new \SubtleForms\Engine\SubmissionContext( 1, array( 'who' => $answer ) );
			$context->setMeta( 'form_schema', array( 'fields' => array( array( 'key' => 'who', 'type' => 'text', 'label' => 'Who' ) ) ) );
			$context->setMeta( 'submission_id', 0 );
			$context->setMeta(
				'current_step_settings',
				array(
					'to'      => 'owner@example.com',
					'subject' => 'S',
					'message' => 'M',
					'replyTo' => '{field:who}',
					'headers' => array( 'From: {field:who}' ),
				)
			);
			( new \SubtleForms\Engine\Actions\EmailAction() )->handle( $context );
		}
		remove_filter( 'pre_schedule_event', $capture, 10 );
		$this->assertCount( 3, $jobs );
		foreach ( $jobs as $job ) {
			$headers = implode( "\n", (array) $job['headers'] );
			$this->assertStringNotContainsString( 'Reply-To', $headers );
			$this->assertStringNotContainsString( 'Bcc', $headers );
			$this->assertStringNotContainsString( '{field:', $headers, 'From never takes a merge tag.' );
		}
	}

	public function test_only_people_who_manage_the_plugin_can_import(): void {
		wp_set_current_user( 0 );
		$this->assertContains( $this->rest( 'GET', '/tools/migrate/sources' )->get_status(), array( 401, 403 ) );
		$this->assertContains( $this->rest( 'POST', '/tools/migrate/sources/cf7/import', array( 'ids' => array( (string) $this->seeded['cf7'][0] ) ) )->get_status(), array( 401, 403 ) );

		$editor = wp_insert_user(
			array(
				'user_login' => 'sf_import_editor_' . wp_generate_password( 6, false ),
				'user_pass'  => wp_generate_password(),
				'role'       => 'editor',
			)
		);
		wp_set_current_user( $editor );
		$this->assertContains( $this->rest( 'POST', '/tools/migrate/sources/cf7/import', array( 'ids' => array( (string) $this->seeded['cf7'][0] ) ) )->get_status(), array( 401, 403 ) );
		$this->assertContains( $this->rest( 'GET', '/tools/migrate/sources/cf7/forms' )->get_status(), array( 401, 403 ) );
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $editor );

		global $wpdb;
		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_forms WHERE config LIKE %s", '%' . $wpdb->esc_like( '"importRef":"cf7:' . $this->seeded['cf7'][0] . '"' ) . '%' ) ) );
	}

	public function test_bad_requests_are_refused(): void {
		$this->assertSame( 404, $this->rest( 'GET', '/tools/migrate/sources/wpforms/forms' )->get_status() );
		$this->assertSame( 422, $this->rest( 'POST', '/tools/migrate/sources/cf7/import', array( 'ids' => array() ) )->get_status() );
		$this->assertSame( 422, $this->rest( 'POST', '/tools/migrate/sources/cf7/import', array( 'ids' => array( '../1' ) ) )->get_status() );
		$missing = $this->import( 'cf7', array( 999999 ) );
		$this->assertSame( 'missing', $missing[0]['status'] );
	}
}
