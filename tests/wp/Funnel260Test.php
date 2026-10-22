<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Form completion funnel (2.6.0): the beacon route, its checks and rate
 * limit, the daily totals, the report, pruning and uninstall.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Analytics\Funnel;
use SubtleForms\Analytics\Stats;
use SubtleForms\Api\FunnelApi;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class Funnel260Test extends TestCase {

	const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

	/** @var mixed */
	private $settingsBefore;

	protected function setUp(): void {
		parent::setUp();
		$this->settingsBefore       = get_option( 'subtleforms_settings', array() );
		$_SERVER['HTTP_USER_AGENT'] = self::BROWSER;
		$_SERVER['REMOTE_ADDR']     = '203.0.113.' . wp_rand( 1, 250 );
		$this->setSettings( array() );
		Funnel::maybeInstall();
	}

	protected function tearDown(): void {
		global $wpdb;
		foreach ( $this->formIds as $id ) {
			$wpdb->delete( Funnel::table(), array( 'form_id' => $id ) );
			$wpdb->delete( Stats::table(), array( 'form_id' => $id ) );
		}
		update_option( 'subtleforms_settings', $this->settingsBefore );
		unset( $_SERVER['HTTP_USER_AGENT'] );
		$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
		parent::tearDown();
	}

	private function setSettings( array $overrides ): void {
		$settings = is_array( $this->settingsBefore ) ? $this->settingsBefore : array();
		$settings = array_merge(
			$settings,
			array(
				'ext_analytics_enabled'       => true,
				'ext_analytics_view_tracking' => true,
			),
			$overrides
		);
		update_option( 'subtleforms_settings', $settings );
		wp_cache_flush();
	}

	private function form( array $metadata = array() ): int {
		$id = $this->publish(
			array(
				array( 'id' => 's1', 'type' => 'step', 'key' => 'step_1', 'config' => array( 'label' => 'About you' ) ),
				array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'f2', 'key' => 'phone', 'type' => 'phone', 'label' => 'Phone' ),
				array( 'id' => 's2', 'type' => 'step', 'key' => 'step_2', 'config' => array( 'label' => 'Details' ) ),
				array( 'id' => 'f3', 'key' => 'message', 'type' => 'textarea', 'label' => 'Message' ),
			)
		);
		if ( $metadata ) {
			$repo                 = new FormsRepository();
			$version              = $repo->loadSchemaVersion( $id );
			$schema               = $version['schema'];
			$schema['metadata']   = array_merge( $schema['metadata'], $metadata );
			$repo->saveSchemaVersion( $id, $schema, true );
			wp_cache_flush();
		}
		return $id;
	}

	private function beacon( int $formId, array $params ): array {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $formId . '/funnel' );
		$request->set_header( 'content-type', 'application/x-www-form-urlencoded' );
		$request->set_body_params( $params );
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => (array) $response->get_data() );
	}

	private function report( int $formId, int $days = 30 ): array {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/analytics/funnel' );
		$request->set_param( 'form_id', $formId );
		$request->set_param( 'days', $days );
		$response = rest_do_request( $request );
		wp_set_current_user( 0 );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		return (array) $response->get_data()['data'];
	}

	private function rows( int $formId ): array {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT metric, field_key, count FROM ' . Funnel::table() . ' WHERE form_id = %d ORDER BY metric, field_key', $formId ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[ $row['metric'] . ':' . $row['field_key'] ] = (int) $row['count'];
		}
		return $out;
	}

	public function test_the_table_is_installed_with_its_version(): void {
		global $wpdb;
		$this->assertSame( Funnel::DB_VERSION, get_option( Funnel::DB_OPTION ) );
		$this->assertSame( Funnel::table(), $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', Funnel::table() ) ) );
	}

	public function test_a_drop_counts_the_field_and_the_step_only(): void {
		$formId = $this->form();
		$result = $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone', 's' => '0', 'v' => 'secret answer' ) );
		$this->assertSame( 200, $result['status'] );
		$this->assertTrue( $result['data']['tracked'] );

		$this->assertSame( array( 'drop:phone' => 1, 'drop_step:0' => 1 ), $this->rows( $formId ) );

		global $wpdb;
		$dump = wp_json_encode( $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . Funnel::table() . ' WHERE form_id = %d', $formId ), ARRAY_A ) );
		$this->assertStringNotContainsString( 'secret', $dump, 'Values are never stored.' );
		$this->assertStringNotContainsString( '203.0.113', $dump, 'Addresses are never stored.' );
	}

	public function test_unknown_keys_and_steps_are_not_stored(): void {
		$formId = $this->form();
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'credit_card_number', 's' => '7; DROP' ) );
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => str_repeat( 'x', 500 ) ) );
		$this->assertSame( array( 'drop:' => 2 ), $this->rows( $formId ), 'Counted as left somewhere, with no made-up key or step.' );
	}

	public function test_bad_requests_are_refused(): void {
		$formId = $this->form();
		$this->assertSame( 400, $this->beacon( $formId, array( 'a' => 'delete', 'f' => 'phone' ) )['status'] );
		$this->assertSame( 400, $this->beacon( $formId, array() )['status'] );
		$this->assertSame( 404, $this->beacon( 99999999, array( 'a' => 'drop', 'f' => 'phone' ) )['status'] );

		( new FormsRepository() )->update( $formId, array( 'status' => 'draft' ) );
		wp_cache_flush();
		$this->assertSame( 404, $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) )['status'], 'Only published forms.' );
		$this->assertSame( array(), $this->rows( $formId ) );
	}

	public function test_nothing_is_counted_when_tracking_is_off(): void {
		$formId = $this->form();
		$this->setSettings( array( 'ext_analytics_view_tracking' => false ) );
		$this->assertFalse( Funnel::tracks() );
		$result = $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) );
		$this->assertFalse( $result['data']['tracked'] );

		$this->setSettings( array( 'ext_analytics_enabled' => false ) );
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) );
		$this->assertSame( array(), $this->rows( $formId ) );
		$this->assertFalse( $this->report( $formId )['tracking'], 'The report says tracking is off.' );

		$this->setSettings( array() );
		$this->assertTrue( $this->report( $formId )['tracking'] );
	}

	public function test_a_form_that_opted_out_is_not_counted(): void {
		$formId = $this->form( array( 'integrations' => array( 'analytics' => array( 'enabled' => false ) ) ) );
		$this->assertFalse( $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) )['data']['tracked'] );
		$this->assertSame( array(), $this->rows( $formId ) );
		$this->assertFalse( $this->report( $formId )['form_tracked'] );
	}

	public function test_robots_and_managers_are_not_counted(): void {
		$formId = $this->form();
		$_SERVER['HTTP_USER_AGENT'] = 'Mozilla/5.0 (compatible; bingbot/2.0)';
		$this->assertFalse( $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) )['data']['tracked'] );
		$_SERVER['HTTP_USER_AGENT'] = '';
		$this->assertFalse( $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) )['data']['tracked'] );

		$_SERVER['HTTP_USER_AGENT'] = self::BROWSER;
		$this->asAdmin();
		$this->assertTrue( Funnel::skipsCurrentUser() );
		$this->assertFalse( $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) )['data']['tracked'] );
		wp_set_current_user( 0 );
		$this->assertFalse( Funnel::skipsCurrentUser() );

		$this->assertSame( array(), $this->rows( $formId ) );
	}

	public function test_views_by_managers_are_not_counted_either(): void {
		global $wpdb;
		$formId = $this->form();
		$views  = static function () use ( $wpdb, $formId ) {
			return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(views),0) FROM ' . Stats::table() . ' WHERE form_id = %d', $formId ) );
		};
		$view = static function () use ( $formId ) {
			return (array) rest_do_request( new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $formId . '/view' ) )->get_data();
		};

		$this->asAdmin();
		$this->assertFalse( $view()['tracked'], 'A manager viewing the form is not counted.' );
		$this->assertSame( 0, $views() );

		wp_set_current_user( 0 );
		$this->assertTrue( $view()['tracked'], 'A visitor still is.' );
		$this->assertSame( 1, $views() );

		$subscriber = wp_insert_user( array( 'user_login' => 'sf_funnel_sub_' . wp_rand(), 'user_pass' => wp_generate_password(), 'role' => 'subscriber' ) );
		wp_set_current_user( $subscriber );
		$this->assertTrue( $view()['tracked'], 'A logged-in visitor who cannot manage forms is counted.' );
		$this->assertSame( 2, $views() );
		wp_set_current_user( 0 );
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $subscriber );
	}

	public function test_each_address_is_limited_per_form(): void {
		$formId = $this->form();
		$other  = $this->form();
		for ( $i = 0; $i < FunnelApi::BEACON_LIMIT; $i++ ) {
			$this->assertSame( 200, $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'name' ) )['status'] );
		}
		$this->assertSame( 429, $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'name' ) )['status'] );
		$this->assertSame( FunnelApi::BEACON_LIMIT, $this->rows( $formId )['drop:name'] );

		$this->assertSame( 200, $this->beacon( $other, array( 'a' => 'drop', 'f' => 'name' ) )['status'], 'The limit is per form.' );
		$_SERVER['REMOTE_ADDR'] = '198.51.100.7';
		$this->assertSame( 200, $this->beacon( $formId, array( 'a' => 'drop', 'f' => 'name' ) )['status'], 'And per address.' );

		global $wpdb;
		$keys = $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '%subtleforms_rl_funnel_%'" );
		$this->assertNotEmpty( $keys );
		$this->assertStringNotContainsString( '198.51.100.7', implode( ' ', $keys ), 'The bucket name holds a hash, not the address.' );
	}

	public function test_made_up_form_ids_create_no_rate_limit_records(): void {
		global $wpdb;
		$count  = static function () use ( $wpdb ): int {
			return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE '%subtleforms_rl_funnel_%'" );
		};
		$before = $count();
		for ( $i = 0; $i < 50; $i++ ) {
			$this->assertSame( 404, $this->beacon( 900000 + $i, array( 'a' => 'drop', 'f' => 'name' ) )['status'] );
		}
		$this->assertSame( $before, $count(), 'Unknown forms never reach the rate limiter.' );
	}

	public function test_one_address_is_limited_across_all_forms(): void {
		$forms = array( $this->form(), $this->form(), $this->form(), $this->form() );
		for ( $f = 0; $f < 3; $f++ ) {
			for ( $i = 0; $i < FunnelApi::BEACON_LIMIT; $i++ ) {
				$this->assertSame( 200, $this->beacon( $forms[ $f ], array( 'a' => 'drop', 'f' => 'name' ) )['status'] );
			}
		}
		$this->assertSame( 3 * FunnelApi::BEACON_LIMIT, FunnelApi::IP_LIMIT );
		$this->assertSame( 429, $this->beacon( $forms[3], array( 'a' => 'drop', 'f' => 'name' ) )['status'], 'The address is over its all-forms limit.' );
		$_SERVER['REMOTE_ADDR'] = '198.51.100.8';
		$this->assertSame( 200, $this->beacon( $forms[3], array( 'a' => 'drop', 'f' => 'name' ) )['status'] );
	}

	public function test_move_and_undo_correct_an_earlier_report_without_going_below_zero(): void {
		$formId = $this->form();
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'name', 's' => '0' ) );
		$this->beacon( $formId, array( 'a' => 'move', 'f' => 'message', 's' => '1', 'pf' => 'name', 'ps' => '0' ) );
		$this->assertSame( array( 'drop:message' => 1, 'drop:name' => 0, 'drop_step:0' => 0, 'drop_step:1' => 1 ), $this->rows( $formId ) );

		$this->beacon( $formId, array( 'a' => 'undo', 'pf' => 'message', 'ps' => '1' ) );
		$this->beacon( $formId, array( 'a' => 'undo', 'pf' => 'message', 'ps' => '1' ) );
		$this->assertSame( array( 'drop:message' => 0, 'drop:name' => 0, 'drop_step:0' => 0, 'drop_step:1' => 0 ), $this->rows( $formId ) );
	}

	public function test_the_report_reuses_views_and_counts_real_entries(): void {
		$formId = $this->form();

		for ( $i = 0; $i < 10; $i++ ) {
			Stats::increment( $formId, 'views' );
		}
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone', 's' => '0' ) );
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone', 's' => '0' ) );
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'message', 's' => '1' ) );

		$repo = new SubmissionsRepository();
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'A' ), 'status' => 'completed' ) );
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'B' ), 'status' => 'unread' ) );
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Test' ), 'status' => 'preview' ) );
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Spam' ), 'status' => 'spam' ) );
		$repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Gone' ), 'status' => 'trash' ) );

		// Old totals outside the window are not counted.
		Funnel::adjust( $formId, Funnel::METRIC_DROP, 'name', 1, gmdate( 'Y-m-d', time() - 40 * DAY_IN_SECONDS ) );

		$report = $this->report( $formId, 30 );
		$this->assertTrue( $report['tracking'] );
		$this->assertSame( 10, $report['seen'] );
		$this->assertSame( 2, $report['submitted'], 'Preview, spam and trashed entries do not count.' );
		$this->assertSame( 3, $report['left'] );
		$this->assertSame( 5, $report['started'], 'Started is everyone who sent the form or left it.' );
		$this->assertSame( array( 'phone', 'message' ), array_column( $report['fields'], 'key' ), 'Most drop-offs first.' );
		$this->assertSame( 'Phone', $report['fields'][0]['label'] );
		$this->assertSame( 'phone', $report['fields'][0]['type'] );
		$this->assertSame( 2, $report['fields'][0]['count'] );
		$this->assertSame(
			array( array( 'index' => 0, 'label' => 'About you', 'count' => 2 ), array( 'index' => 1, 'label' => 'Details', 'count' => 1 ) ),
			$report['steps']
		);

		$wide = $this->report( $formId, 90 );
		$this->assertSame( 4, $wide['left'], 'A wider range includes the older day.' );
	}

	public function test_the_summary_adds_a_completion_rate(): void {
		$formId = $this->form();
		Stats::increment( $formId, 'views' );
		Stats::increment( $formId, 'submissions' );
		Stats::increment( $formId, 'submissions' );
		Stats::increment( $formId, 'submissions' );
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone' ) );

		$this->asAdmin();
		$request  = new \WP_REST_Request( 'GET', '/subtleforms/v1/analytics/summary' );
		$response = rest_do_request( $request );
		$row      = (array) ( (array) $response->get_data()['data']['forms'] )[ $formId ];
		$this->assertSame( 1, $row['left'] );
		$this->assertSame( 75.0, $row['completion'] );
	}

	public function test_completion_is_full_when_forms_were_sent_and_nobody_left(): void {
		$formId = $this->form();
		$empty  = $this->form();
		Stats::increment( $formId, 'views' );
		Stats::increment( $formId, 'submissions' );
		Stats::increment( $formId, 'submissions' );
		Stats::increment( $empty, 'views' );

		$this->asAdmin();
		$response = rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1/analytics/summary' ) );
		$forms    = (array) $response->get_data()['data']['forms'];
		$this->assertSame( 0, $forms[ $formId ]['left'] );
		$this->assertSame( 100.0, $forms[ $formId ]['completion'], 'Sent forms and no drop-off rows is a full completion.' );
		$this->assertNull( $forms[ $empty ]['completion'], 'Nobody started: no rate.' );
	}

	public function test_deleting_a_form_removes_its_funnel_and_spam_rows(): void {
		global $wpdb;
		$formId = $this->form();
		$kept   = $this->form();
		\SubtleForms\Analytics\SpamStats::maybeInstall();
		$this->beacon( $formId, array( 'a' => 'drop', 'f' => 'phone', 's' => '0' ) );
		$this->beacon( $kept, array( 'a' => 'drop', 'f' => 'phone', 's' => '0' ) );
		\SubtleForms\Analytics\SpamStats::record( $formId, 'honeypot' );
		\SubtleForms\Analytics\SpamStats::record( $kept, 'honeypot' );
		$this->assertNotEmpty( $this->rows( $formId ) );

		$this->assertTrue( ( new FormsRepository() )->delete( $formId ) );

		$spam = \SubtleForms\Analytics\SpamStats::table();
		$this->assertSame( array(), $this->rows( $formId ), 'Funnel rows are gone.' );
		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$spam} WHERE form_id = %d", $formId ) ), 'Spam rows are gone.' );
		$this->assertNotEmpty( $this->rows( $kept ), 'Other forms keep theirs.' );
		$this->assertSame( 1, \SubtleForms\Analytics\SpamStats::summary( 30, $kept )['total'] );
		$this->assertSame( 1, \SubtleForms\Analytics\SpamStats::summary( 30 )['total'] - $this->otherSpam( $kept ), 'The site total no longer counts the deleted form.' );
		$wpdb->delete( $spam, array( 'form_id' => $kept ) );
	}

	/** Spam counted for forms other than the given one (rows from other tests). */
	private function otherSpam( int $formId ): int {
		global $wpdb;
		$spam = \SubtleForms\Analytics\SpamStats::table();
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(blocked),0) FROM {$spam} WHERE form_id <> %d", $formId ) );
	}

	public function test_the_report_is_for_managers_only(): void {
		$formId  = $this->form();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/analytics/funnel' );
		$request->set_param( 'form_id', $formId );
		wp_set_current_user( 0 );
		$this->assertContains( rest_do_request( $request )->get_status(), array( 401, 403 ) );
	}

	public function test_old_totals_are_pruned_after_the_retention_period(): void {
		$formId = $this->form();
		$old    = gmdate( 'Y-m-d', time() - 200 * DAY_IN_SECONDS );
		$recent = gmdate( 'Y-m-d', time() - 100 * DAY_IN_SECONDS );
		Funnel::adjust( $formId, Funnel::METRIC_DROP, 'name', 1, $old );
		Funnel::adjust( $formId, Funnel::METRIC_DROP, 'phone', 1, $recent );
		Funnel::adjust( $formId, Funnel::METRIC_DROP, 'message', 1 );

		$this->assertSame( 180, Funnel::retentionDays(), 'Kept for 180 days by default.' );
		do_action( Stats::PRUNE_HOOK );
		$this->assertSame( array( 'drop:message' => 1, 'drop:phone' => 1 ), $this->rows( $formId ) );

		$this->setSettings( array( Funnel::RETENTION_SETTING => 30 ) );
		Funnel::prune();
		$this->assertSame( array( 'drop:message' => 1 ), $this->rows( $formId ) );
	}

	public function test_uninstall_finds_the_table_and_the_option(): void {
		global $wpdb;
		// The same lookup Uninstaller::clean_site() drops tables from.
		$like   = $wpdb->esc_like( $wpdb->prefix . 'subtleforms_' ) . '%';
		$tables = $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', $like ) );
		$this->assertContains( Funnel::table(), $tables );
		$this->assertStringStartsWith( 'subtleforms_', Funnel::DB_OPTION, 'Removed with the other subtleforms_ options.' );
		$this->assertStringStartsWith( 'subtleforms_', 'subtleforms_rl_funnel_x', 'Rate limit transients use the plugin prefix.' );
		$this->assertStringStartsWith( 'subtleforms', Stats::PRUNE_HOOK, 'The prune event is cleared with the plugin cron.' );
	}

	public function test_the_privacy_text_mentions_the_statistics_only_when_on(): void {
		$manager = new \SubtleForms\Privacy\PrivacyManager( new \SubtleForms\Support\Settings(), new SubmissionsRepository() );
		$method  = new \ReflectionMethod( $manager, 'get_privacy_policy_text' );
		$method->setAccessible( true );
		$this->assertStringContainsString( 'last field someone touched', $method->invoke( $manager ) );

		$this->setSettings( array( 'ext_analytics_view_tracking' => false ) );
		$this->assertStringNotContainsString( 'last field someone touched', $method->invoke( $manager ) );
	}
}
