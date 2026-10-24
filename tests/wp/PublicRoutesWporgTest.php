<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * Public REST routes (WordPress.org review): each route that anyone may call
 * is one that logged-out visitors need, checks that the form exists, is
 * published and takes the action, and is rate limited. Every other route
 * checks the user's capability.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;

final class PublicRoutesWporgTest extends TestCase {

	/** Create a form with an upload field, optional restrictions and status. */
	private function uploadForm( array $restrictions = array(), string $status = 'published' ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'         => 'regular',
				'name'         => 'Upload test',
				'title'        => 'Upload test',
				'restrictions' => $restrictions,
			),
			'schema_version' => 1,
			'fields'         => array(
				array( 'id' => 'f', 'key' => 'cv', 'type' => 'file_upload', 'label' => 'CV' ),
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
			),
		);
		$id     = $repo->create(
			array(
				'title'  => 'Upload test',
				'status' => $status,
				'schema' => $schema,
			)
		);
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	private function upload( int $formId, string $field ): \WP_REST_Response {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/uploads' );
		$request->set_param( 'form_id', $formId );
		$request->set_param( 'field', $field );
		return rest_do_request( $request );
	}

	public function test_only_the_visitor_routes_are_public(): void {
		$public = array();
		foreach ( rest_get_server()->get_routes() as $route => $endpoints ) {
			if ( 0 !== strpos( $route, '/subtleforms/v1' ) ) {
				continue;
			}
			foreach ( $endpoints as $endpoint ) {
				if ( '__return_true' === ( $endpoint['permission_callback'] ?? null ) ) {
					$public[] = $route;
				}
			}
		}
		sort( $public );
		$this->assertSame(
			array( '/subtleforms/v1/forms/(?P<id>\d+)/spam-token', '/subtleforms/v1/submit', '/subtleforms/v1/uploads' ),
			array_values( array_unique( $public ) )
		);
	}

	public function test_uploads_need_a_published_form_and_an_upload_field(): void {
		$this->assertSame( 404, $this->upload( 99999999, 'cv' )->get_status(), 'unknown form' );

		$draft = $this->uploadForm( array(), 'draft' );
		$this->assertSame( 404, $this->upload( $draft, 'cv' )->get_status(), 'draft form' );

		$id = $this->uploadForm();
		$this->assertSame( 404, $this->upload( $id, 'name' )->get_status(), 'not an upload field' );
		$this->assertSame( 404, $this->upload( $id, 'nope' )->get_status(), 'unknown field' );
		$this->assertSame( 400, $this->upload( $id, 'cv' )->get_status(), 'the right field gets as far as the file check' );
	}

	public function test_a_closed_form_takes_no_uploads(): void {
		$closed = $this->uploadForm( array( 'closeAt' => '2001-01-01T00:00' ) );
		$response = $this->upload( $closed, 'cv' );
		$this->assertSame( 403, $response->get_status() );
		$this->assertStringContainsString( 'closed', wp_json_encode( $response->get_data() ) );

		$login = $this->uploadForm( array( 'requireLogin' => true ) );
		$this->assertSame( 403, $this->upload( $login, 'cv' )->get_status(), 'logged-in only form' );
	}

	public function test_uploads_are_rate_limited_per_client(): void {
		$statuses = array();
		for ( $i = 0; $i < 31; $i++ ) {
			$statuses[] = $this->upload( 99999999, 'cv' )->get_status();
		}
		$this->assertSame( 429, end( $statuses ) );
	}

	public function test_the_schema_of_a_draft_form_is_not_public(): void {
		$draft = $this->uploadForm( array(), 'draft' );
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $draft . '/schema' );
		$this->assertSame( 404, rest_do_request( $request )->get_status() );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/99999999/schema' );
		$this->assertSame( 404, rest_do_request( $request )->get_status() );
	}

	public function test_a_spam_token_is_never_issued_for_a_draft_form(): void {
		$draft  = $this->uploadForm( array(), 'draft' );
		$ticket = \SubtleForms\Engine\SpamProtection::issue_ticket( $draft );
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $draft . '/spam-token' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'token' => $ticket ) ) );
		$this->assertSame( 404, rest_do_request( $request )->get_status() );
	}

	public function test_a_draft_or_missing_form_takes_no_submission(): void {
		$draft = $this->uploadForm( array(), 'draft' );
		$this->assertSame( 404, $this->submit( $draft, array( 'name' => 'Ada' ) )['status'] );
		$this->assertSame( 404, $this->submit( 99999999, array( 'name' => 'Ada' ) )['status'] );
	}

	public function test_the_more_features_card_is_dismissed_for_the_user_only(): void {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/more-features/dismiss' );
		$this->assertContains( rest_do_request( $request )->get_status(), array( 401, 403 ), 'visitors cannot call it' );

		$this->asAdmin();
		$user = get_current_user_id();
		delete_user_meta( $user, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META );
		$this->assertTrue( \SubtleForms\Admin\AdminMenu::more_features()['show'] );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/more-features/dismiss' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$this->assertSame( 200, rest_do_request( $request )->get_status() );
		$this->assertFalse( \SubtleForms\Admin\AdminMenu::more_features()['show'] );
		$this->assertSame( 'https://subtleforms.com/pro/', \SubtleForms\Admin\AdminMenu::more_features()['url'] );
		delete_user_meta( $user, \SubtleForms\Admin\AdminMenu::MORE_FEATURES_META );
	}
}
