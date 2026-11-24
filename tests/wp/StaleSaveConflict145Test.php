<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Free #145: a save from a stale builder tab must be refused, and every save
 * must hand back the form's new ETag so the same tab can keep saving.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

final class StaleSaveConflict145Test extends TestCase {

	private function admin(): void {
		$ids = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ) );
		wp_set_current_user( (int) $ids[0] );
	}

	private function schema( string ...$keys ): array {
		$fields = array();
		foreach ( $keys as $key ) {
			$fields[] = array( 'id' => 'f_' . $key, 'key' => $key, 'type' => 'text', 'label' => ucfirst( $key ) );
		}
		return array(
			'metadata'       => array( 'type' => 'regular', 'name' => 'WP test', 'title' => 'WP test' ),
			'schema_version' => 1,
			'fields'         => $fields,
		);
	}

	private function call( string $method, string $path, ?array $body = null, ?string $ifMatch = null ): \WP_REST_Response {
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $path );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		if ( null !== $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		if ( null !== $ifMatch ) {
			$request->set_header( 'If-Match', $ifMatch );
		}
		return rest_do_request( $request );
	}

	private function etag( \WP_REST_Response $response ): string {
		$headers = $response->get_headers();
		return (string) ( $headers['ETag'] ?? '' );
	}

	private function save( int $id, array $schema, bool $activate, ?string $ifMatch ): \WP_REST_Response {
		return $this->call( 'POST', "/forms/{$id}/schema", array( 'schema' => $schema, 'activate' => $activate ), $ifMatch );
	}

	public function test_a_stale_if_match_on_a_schema_save_is_refused_with_the_current_etag(): void {
		$this->admin();
		$id     = $this->publish( array( array( 'id' => 'f_a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$opened = $this->etag( $this->call( 'GET', "/forms/{$id}" ) );
		$this->assertNotSame( '', $opened );

		// Tab A saves a draft.
		$first = $this->save( $id, $this->schema( 'a', 'email' ), false, $opened );
		$this->assertSame( 200, $first->get_status() );

		// Tab B still holds the ETag it opened with.
		$stale = $this->save( $id, $this->schema( 'a', 'number' ), false, $opened );
		$this->assertSame( 409, $stale->get_status() );
		$data = $stale->get_data();
		$this->assertSame( $this->etag( $first ), $data['error']['meta']['current_etag'] ?? null );
	}

	public function test_a_stale_if_match_is_refused_after_a_publish_too(): void {
		$this->admin();
		$id     = $this->publish( array( array( 'id' => 'f_a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$opened = $this->etag( $this->call( 'GET', "/forms/{$id}" ) );

		$this->assertSame( 201, $this->save( $id, $this->schema( 'a', 'email' ), true, $opened )->get_status() );
		$this->assertSame( 409, $this->save( $id, $this->schema( 'a', 'number' ), true, $opened )->get_status() );
	}

	public function test_a_save_with_the_current_etag_succeeds_and_returns_a_new_one(): void {
		$this->admin();
		$id     = $this->publish( array( array( 'id' => 'f_a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$opened = $this->etag( $this->call( 'GET', "/forms/{$id}" ) );

		$saved = $this->save( $id, $this->schema( 'a', 'email' ), false, $opened );
		$this->assertSame( 200, $saved->get_status() );
		$next = $this->etag( $saved );
		$this->assertNotSame( '', $next );
		$this->assertNotSame( $opened, $next );
		$this->assertSame( $next, $saved->get_data()['data']['etag'] ?? null );
		$this->assertSame( $next, $this->etag( $this->call( 'GET', "/forms/{$id}" ) ), 'what the save returns is what the next read returns' );
	}

	public function test_two_saves_in_a_row_using_the_returned_etag_both_succeed(): void {
		$this->admin();
		$id     = $this->publish( array( array( 'id' => 'f_a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$opened = $this->etag( $this->call( 'GET', "/forms/{$id}" ) );

		$one = $this->save( $id, $this->schema( 'a', 'email' ), false, $opened );
		$two = $this->save( $id, $this->schema( 'a', 'email', 'number' ), true, $this->etag( $one ) );
		$this->assertSame( 201, $two->get_status() );
		$three = $this->save( $id, $this->schema( 'a', 'email', 'number', 'city' ), false, $this->etag( $two ) );
		$this->assertSame( 200, $three->get_status() );
	}

	public function test_a_save_without_if_match_still_succeeds(): void {
		$this->admin();
		$id = $this->publish( array( array( 'id' => 'f_a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$this->assertSame( 200, $this->save( $id, $this->schema( 'a', 'email' ), false, null )->get_status() );
		$this->assertSame( 201, $this->save( $id, $this->schema( 'a', 'number' ), true, null )->get_status() );
	}

	public function test_a_form_update_changes_the_etag_and_a_stale_update_is_refused(): void {
		$this->admin();
		$id     = $this->publish( array( array( 'id' => 'f_a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) );
		$opened = $this->etag( $this->call( 'GET', "/forms/{$id}" ) );

		$renamed = $this->call( 'PUT', "/forms/{$id}", array( 'title' => 'Renamed' ), $opened );
		$this->assertSame( 200, $renamed->get_status() );
		$this->assertNotSame( $opened, $this->etag( $renamed ) );
		$this->assertSame( 409, $this->call( 'PUT', "/forms/{$id}", array( 'title' => 'Again' ), $opened )->get_status() );
	}
}
