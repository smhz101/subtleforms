<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Menu order, the Upgrade item, the dashboard and reports endpoints, the
 * WordPress dashboard widget and the admin bar node.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminBar;
use SubtleForms\Admin\AdminMenu;
use SubtleForms\Admin\DashboardWidget;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Capabilities;

final class PageHeaderMenuTest extends TestCase {

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		if ( ! defined( 'SUBTLEFORMS_TESTING' ) ) {
			define( 'SUBTLEFORMS_TESTING', true );
		}
	}

	protected function tearDown(): void {
		remove_all_filters( 'subtleforms/admin/upgrade_menu_item' );
		remove_all_actions( 'subtleforms/admin_menu' );
		unset( $GLOBALS['current_screen'] );
		AdminMenu::forget_unread_count();
		parent::tearDown();
	}

	private function slugs(): array {
		global $menu, $submenu;
		$menu    = array();
		$submenu = array();
		$this->asAdmin();
		$m = new AdminMenu( new Capabilities() );
		$m->register_menu();
		$m->pin_menu_order();
		return array_map( static fn( $i ) => $i[2], $submenu['subtleforms'] ?? array() );
	}

	private function get( string $route, array $params = array() ): array {
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1' . $route );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		foreach ( $params as $k => $v ) {
			$request->set_param( $k, $v );
		}
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => $response->get_data() );
	}

	private function fresh(): void {
		global $wpdb;
		AdminMenu::forget_unread_count();
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '%subtleforms_ov_%'" );
		wp_cache_flush();
	}

	public function test_upgrade_item_is_after_settings_in_free(): void {
		$slugs = $this->slugs();
		$this->assertSame( 'subtleforms-settings', $slugs[ count( $slugs ) - 2 ] );
		$this->assertSame( AdminMenu::UPGRADE_SLUG, end( $slugs ) );
	}

	public function test_upgrade_item_is_absent_when_the_filter_says_no(): void {
		add_filter( 'subtleforms/admin/upgrade_menu_item', '__return_false' );
		$slugs = $this->slugs();
		$this->assertNotContains( AdminMenu::UPGRADE_SLUG, $slugs );
		$this->assertSame( 'subtleforms-settings', end( $slugs ) );
	}

	public function test_add_on_items_land_between_reports_and_settings(): void {
		add_action(
			'subtleforms/admin_menu',
			static function () {
				add_submenu_page( 'subtleforms', 'Orders', 'Orders', 'manage_options', 'subtleforms-orders', '__return_null' );
			}
		);
		// An add-on that registers late, after the pin ran once, is still placed before Settings.
		$slugs = $this->slugs();
		$orders   = array_search( 'subtleforms-orders', $slugs, true );
		$reports  = array_search( 'subtleforms-reports', $slugs, true );
		$settings = array_search( 'subtleforms-settings', $slugs, true );
		$this->assertNotFalse( $orders );
		$this->assertGreaterThan( $reports, $orders );
		$this->assertLessThan( $settings, $orders );
	}

	public function test_dashboard_returns_every_figure_in_one_call(): void {
		$this->asAdmin();
		$this->fresh();
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		( new SubmissionsRepository() )->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Ada' ), 'status' => 'completed' ) );
		$this->fresh();
		$res = $this->get( '/dashboard' );
		$this->assertSame( 200, $res['status'] );
		$data = $res['data']['data'];
		foreach ( array( 'stats', 'trend', 'recent_submissions', 'top_forms', 'attention', 'checklist' ) as $key ) {
			$this->assertArrayHasKey( $key, $data );
		}
		$this->assertCount( 90, $data['trend'] );
		$this->assertLessThanOrEqual( 8, count( $data['recent_submissions'] ) );
		$this->assertNotEmpty( $data['recent_submissions'] );
		$this->assertArrayHasKey( 'spam_blocked_week', $data['stats'] );
		$this->assertArrayHasKey( 'unread', $data['attention'] );
	}

	public function test_reports_validates_dates_and_returns_series_breakdown_and_fields(): void {
		$this->asAdmin();
		$formId = $this->publish(
			array(
				array( 'id' => 'f1', 'key' => 'color', 'type' => 'select', 'label' => 'Colour', 'options' => array( array( 'label' => 'Red', 'value' => 'red' ), array( 'label' => 'Blue', 'value' => 'blue' ) ) ),
			)
		);
		$repo = new SubmissionsRepository();
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'color' => 'red' ), 'status' => 'completed' ) );
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'color' => 'red' ), 'status' => 'completed' ) );
		$this->fresh();

		$bad = $this->get( '/reports', array( 'from' => 'nope' ) );
		$this->assertSame( 422, $bad['status'] );
		$swap = $this->get( '/reports', array( 'from' => '2030-02-02', 'to' => '2030-01-01' ) );
		$this->assertContains( $swap['status'], array( 400, 422 ) );
		$long = $this->get( '/reports', array( 'from' => '2020-01-01', 'to' => '2026-01-01' ) );
		$this->assertContains( $long['status'], array( 400, 422 ) );
		$this->assertSame( 404, $this->get( '/reports', array( 'form_id' => 99999999 ) )['status'] );

		$ok = $this->get( '/reports', array( 'form_id' => $formId ) );
		$this->assertSame( 200, $ok['status'] );
		$data = $ok['data']['data'];
		$this->assertCount( 30, $data['series'] );
		$this->assertArrayHasKey( 'previous', $data['series'][0] );
		$this->assertSame( 2, array_sum( array_column( $data['series'], 'count' ) ) );
		$this->assertNotEmpty( $data['breakdown'] );
		$this->assertNotEmpty( $data['field_summary'] );

		// The second call is the cached one and returns the same figures.
		$this->assertSame( $data, $this->get( '/reports', array( 'form_id' => $formId ) )['data']['data'] );
	}

	public function test_widget_shows_create_first_form_when_there_are_no_forms(): void {
		$this->asAdmin();
		$this->fresh();
		set_transient(
			\SubtleForms\Admin\OverviewData::cacheKey( 'widget' ),
			array( 'forms' => 0, 'week' => 0, 'days' => array( 0, 0, 0, 0, 0, 0, 0 ), 'unread' => 0, 'top' => array() ),
			60
		);
		ob_start();
		DashboardWidget::render();
		$html = ob_get_clean();
		$this->assertStringContainsString( 'Create your first form', $html );
		$this->assertStringNotContainsString( '<polyline', $html );
	}

	public function test_widget_renders_figures_sparkline_and_links(): void {
		$this->asAdmin();
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		( new SubmissionsRepository() )->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Ada' ), 'status' => 'completed' ) );
		$this->fresh();
		ob_start();
		DashboardWidget::render();
		$html = ob_get_clean();
		$this->assertStringContainsString( '<polyline', $html );
		$this->assertStringContainsString( 'View submissions', $html );
		$this->assertStringContainsString( 'Add new form', $html );
		$this->assertStringContainsString( 'tab=unread', $html );
	}

	public function test_widget_cache_ends_with_a_new_entry(): void {
		$this->asAdmin();
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$repo   = new SubmissionsRepository();
		$this->fresh();
		$before = DashboardWidget::data()['week'];
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Bo' ), 'status' => 'completed' ) );
		$this->assertSame( $before + 1, DashboardWidget::data()['week'] );
	}

	public function test_widget_is_registered_only_for_people_who_can_manage(): void {
		global $wp_meta_boxes;
		wp_set_current_user( self::factory_user( 'editor' ) );
		$wp_meta_boxes = array();
		require_once ABSPATH . 'wp-admin/includes/dashboard.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		require_once ABSPATH . 'wp-admin/includes/screen.php';
		require_once ABSPATH . 'wp-admin/includes/template.php';
		\set_current_screen( 'dashboard' );
		DashboardWidget::add();
		$this->assertArrayNotHasKey( DashboardWidget::ID, $wp_meta_boxes['dashboard']['normal']['core'] ?? array() );
		$this->asAdmin();
		DashboardWidget::add();
		$this->assertArrayHasKey( DashboardWidget::ID, $wp_meta_boxes['dashboard']['normal']['core'] );
	}

	private function bar(): \WP_Admin_Bar {
		require_once ABSPATH . WPINC . '/class-wp-admin-bar.php';
		$bar = new \WP_Admin_Bar();
		$bar->initialize();
		AdminBar::add_nodes( $bar );
		return $bar;
	}

	public function test_admin_bar_node_has_children_and_a_bubble_with_the_count(): void {
		$this->asAdmin();
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		( new SubmissionsRepository() )->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Cy' ), 'status' => 'completed' ) );
		AdminMenu::forget_unread_count();
		$bar  = $this->bar();
		$node = $bar->get_node( 'subtleforms' );
		$this->assertNotNull( $node );
		$this->assertStringContainsString( 'ab-icon', $node->title );
		$this->assertStringContainsString( 'awaiting-mod', $node->title );
		$this->assertStringContainsString( 'tab=unread', $node->href );
		foreach ( array( 'submissions', 'forms', 'new' ) as $child ) {
			$this->assertSame( 'subtleforms', $bar->get_node( 'subtleforms-' . $child )->parent );
		}
		$this->assertStringContainsString( 'sf-ab-count', $bar->get_node( 'subtleforms-submissions' )->title );
	}

	public function test_admin_bar_item_follows_comments_and_is_hidden_from_visitors(): void {
		$this->assertSame( 61, has_action( 'admin_bar_menu', array( AdminBar::class, 'add_nodes' ) ) );
		wp_set_current_user( self::factory_user( 'subscriber' ) );
		$this->assertNull( $this->bar()->get_node( 'subtleforms' ) );
		wp_set_current_user( 0 );
		$this->assertNull( $this->bar()->get_node( 'subtleforms' ) );
	}

	public function test_admin_bar_has_no_bubble_at_zero_and_asks_the_database_once(): void {
		global $wpdb;
		$this->asAdmin();
		$wpdb->query( "UPDATE {$wpdb->prefix}subtleforms_submissions SET is_read = 1" );
		wp_cache_flush();
		AdminMenu::forget_unread_count();
		$seen = array();
		$spy  = static function ( $sql ) use ( &$seen ) {
			if ( false !== strpos( $sql, 'subtleforms_submissions' ) ) {
				$seen[] = $sql;
			}
			return $sql;
		};
		add_filter( 'query', $spy );
		$bar = $this->bar();
		$this->bar();
		remove_filter( 'query', $spy );
		$bar_queries = count( $seen );
		$this->assertStringNotContainsString( 'awaiting-mod', $bar->get_node( 'subtleforms' )->title );
		$this->assertSame( 0, $this->countMatching( $bar ), 'no bubble at 0' );
		$this->assertLessThanOrEqual( 1, $bar_queries, 'one count query for the whole request' );
	}

	private function countMatching( \WP_Admin_Bar $bar ): int {
		return substr_count( $bar->get_node( 'subtleforms' )->title, 'pending-count' );
	}

	/**
	 * Seven days means the same thing everywhere: local midnight six days ago,
	 * in the site timezone. The Dashboard tile, the Submissions "Last 7 days"
	 * list and the WP dashboard widget must count the same entries.
	 *
	 * @dataProvider zones
	 */
	public function test_seven_day_count_agrees_across_tile_list_and_widget( string $tz ): void {
		global $wpdb;
		update_option( 'timezone_string', $tz );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}subtleforms_submissions" );
		$this->asAdmin();
		$this->fresh();
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$repo   = new SubmissionsRepository();

		$zone  = new \DateTimeZone( $tz );
		$start = new \DateTimeImmutable( 'today -6 days', $zone );
		$utc   = static fn( \DateTimeImmutable $d ): string => $d->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
		// One second before the window, its first second, a middle day and now.
		$stamps = array(
			'before' => $utc( $start->modify( '-1 second' ) ),
			'first'  => $utc( $start ),
			'middle' => $utc( $start->modify( '+3 days 12 hours' ) ),
			'now'    => $utc( new \DateTimeImmutable( 'now', $zone ) ),
		);
		foreach ( $stamps as $when ) {
			$id = $repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'x' ), 'status' => 'completed' ) );
			$wpdb->update( $wpdb->prefix . 'subtleforms_submissions', array( 'created_at' => $when ), array( 'id' => $id ) );
		}
		$this->fresh();

		$tile   = $this->get( '/dashboard' )['data']['data']['stats']['submissions_this_week'];
		$list   = $this->get( '/submissions', array( 'range' => '7days', 'per_page' => 50 ) );
		$widget = DashboardWidget::data()['week'];

		$this->assertSame( 3, $tile, 'tile counts the first second and later, not the second before' );
		$this->assertSame( $tile, (int) $list['data']['meta']['total'] );
		$this->assertSame( $tile, $widget );
		delete_option( 'timezone_string' );
	}

	public static function zones(): array {
		return array(
			'ahead of UTC'  => array( 'Pacific/Auckland' ),
			'behind UTC'    => array( 'America/Los_Angeles' ),
			'UTC'           => array( 'UTC' ),
		);
	}
}
