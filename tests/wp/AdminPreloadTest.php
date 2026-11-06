<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * REST preloading for the admin app: the subtleforms/admin/preload_paths
 * filter, the per-screen argument, and the preloaded data in the page.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Admin\AdminPreload;

final class AdminPreloadTest extends TestCase {

	private const FORMS = '/subtleforms/v1/forms?orderby=created_at&order=desc&page=1&per_page=100';

	protected function tearDown(): void {
		remove_all_filters( 'subtleforms/admin/preload_paths' );
		unset( $_GET['page'] );
		wp_scripts()->remove( 'subtleforms-admin' );
		parent::tearDown();
	}

	private function localized(): array {
		$data = (string) wp_scripts()->get_data( 'subtleforms-admin', 'data' );
		$this->assertNotSame( '', $data, 'admin data is localized' );
		$this->assertSame( 1, preg_match( '/var subtleformsAdmin = (\{.*?\});\s*(?:var |$)/s', $data, $m ) );
		$decoded = json_decode( $m[1], true );
		$this->assertIsArray( $decoded, json_last_error_msg() . ' ' . substr( $m[1], -200 ) );
		return $decoded;
	}

	private function load( string $page ): array {
		$_GET['page'] = $page;
		wp_scripts()->remove( 'subtleforms-admin' );
		\SubtleForms\Plugin::instance()->container()->get( AdminMenu::class )->enqueue_assets( 'subtleforms_page_' . $page );
		return $this->localized();
	}

	public function test_the_filter_receives_the_screen_and_keeps_only_plugin_paths() {
		$seen = array();
		add_filter(
			'subtleforms/admin/preload_paths',
			function ( $paths, $screen ) use ( &$seen ) {
				$seen[] = $screen;
				return array_merge(
					$paths,
					array( '/subtleforms/v1/forms/counts', '/wp/v2/users', 'https://example.com/subtleforms/v1/x', '/subtleforms/v1/../wp/v2/users', 42, '/subtleforms/v1/' )
				);
			},
			10,
			2
		);
		$this->assertSame( array( '/subtleforms/v1/forms/counts' ), AdminPreload::paths( 'subtleforms-reports' ) );
		$this->assertSame( array( self::FORMS, '/subtleforms/v1/forms/counts' ), AdminPreload::paths( 'subtleforms-forms' ) );
		$this->assertSame( array( 'subtleforms-reports', 'subtleforms-forms' ), $seen );
	}

	public function test_an_admin_gets_the_preloaded_answers_in_the_page_data() {
		$this->asAdmin();
		add_filter(
			'subtleforms/admin/preload_paths',
			function ( $paths, $screen ) {
				return 'subtleforms-settings' === $screen ? array_merge( $paths, array( '/subtleforms/v1/forms/counts' ) ) : $paths;
			},
			10,
			2
		);
		$forms = $this->load( 'subtleforms-forms' );
		$this->assertArrayHasKey( self::FORMS, $forms['preloaded'] );
		$this->assertArrayNotHasKey( '/subtleforms/v1/forms/counts', $forms['preloaded'], 'per screen' );
		$entry = $forms['preloaded'][ self::FORMS ];
		$this->assertArrayHasKey( 'body', $entry );
		$this->assertArrayHasKey( 'data', $entry['body'] );
		$this->assertArrayHasKey( 'total', $entry['body']['meta'] );

		$settings = $this->load( 'subtleforms-settings' );
		$this->assertArrayHasKey( '/subtleforms/v1/forms/counts', $settings['preloaded'] );
		$this->assertArrayNotHasKey( self::FORMS, $settings['preloaded'] );

		$dash = $this->load( 'subtleforms' );
		$this->assertSame( array( '/subtleforms/v1/dashboard' ), array_keys( $dash['preloaded'] ), 'the dashboard preloads its one call' );
		$this->assertArrayHasKey( 'stats', $dash['preloaded']['/subtleforms/v1/dashboard']['body']['data'] );
	}

	public function test_settings_preloads_the_settings_and_the_email_marketing_state() {
		$this->asAdmin();
		$expected = array( '/subtleforms/v1/settings', '/subtleforms/v1/integrations/email-marketing' );
		$this->assertSame( $expected, AdminPreload::defaultPaths( 'subtleforms-settings' ) );

		$loaded = $this->load( 'subtleforms-settings' );
		$this->assertSame( $expected, array_keys( $loaded['preloaded'] ) );

		// The answers are the ones a request would get: settings arrive as { success, data } inside the envelope.
		$settings = $loaded['preloaded']['/subtleforms/v1/settings']['body'];
		$this->assertTrue( $settings['data']['success'] );
		$this->assertArrayHasKey( 'autosave_enabled', $settings['data']['data'] );
		$services = $loaded['preloaded']['/subtleforms/v1/integrations/email-marketing']['body'];
		$this->assertArrayHasKey( 'data', $services );

		$this->assertSame( array(), AdminPreload::defaultPaths( 'subtleforms-reports' ), 'other screens keep their own lists' );
	}

	public function test_a_user_without_access_gets_nothing() {
		$this->assertSame( array(), AdminPreload::collect( 'subtleforms-forms' ), 'logged out' );
		wp_set_current_user( self::factory_user( 'subscriber' ) );
		$this->assertSame( array(), AdminPreload::collect( 'subtleforms-forms' ) );
		wp_set_current_user( self::factory_user( 'editor' ) );
		$this->assertSame( array(), AdminPreload::collect( 'subtleforms-forms' ) );
	}

	public function test_a_route_the_user_may_not_read_is_left_out() {
		$this->asAdmin();
		add_filter(
			'subtleforms/admin/preload_paths',
			function ( $paths ) {
				return array( '/subtleforms/v1/no-such-route' );
			}
		);
		$this->assertSame( array(), AdminPreload::collect( 'subtleforms-forms' ) );
	}

	public function test_the_default_path_matches_what_the_forms_list_requests() {
		$this->asAdmin();
		$preloaded = AdminPreload::collect( 'subtleforms-forms' );
		$this->assertSame( array( self::FORMS ), array_keys( $preloaded ) );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms' );
		$request->set_query_params( array( 'orderby' => 'created_at', 'order' => 'desc', 'page' => 1, 'per_page' => 100 ) );
		$live = rest_do_request( $request );
		$this->assertSame( 200, $live->get_status() );
		$this->assertSame( count( $live->get_data()['data'] ?? array() ), count( $preloaded[ self::FORMS ]['body']['data'] ) );
	}

	public function test_the_screen_slug_comes_from_the_page_query() {
		$_GET['page'] = 'subtleforms-forms';
		$this->assertSame( 'subtleforms-forms', AdminPreload::currentScreen() );
		$_GET['page'] = 'options-general';
		$this->assertSame( '', AdminPreload::currentScreen() );
	}
}
