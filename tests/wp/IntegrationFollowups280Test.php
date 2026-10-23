<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Activator;

/**
 * Free 2.8.0 follow-ups inside WordPress: the moved payment fields degrade,
 * the proxy settings save and change the visitor IP, the schema upgrade runs
 * on the first admin load, and the editor loader carries translations.
 */
class IntegrationFollowups280Test extends TestCase {

	private $settingsBefore;
	private $versionBefore;

	protected function setUp(): void {
		parent::setUp();
		require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		require_once ABSPATH . 'wp-admin/includes/screen.php';
		$this->settingsBefore = get_option( 'subtleforms_settings', null );
		$this->versionBefore  = get_option( 'subtleforms_db_version', null );
	}

	protected function tearDown(): void {
		// The upgrade test drops a table: always put the schema back.
		Activator::activate();
		null === $this->settingsBefore ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $this->settingsBefore );
		null === $this->versionBefore ? delete_option( 'subtleforms_db_version' ) : update_option( 'subtleforms_db_version', $this->versionBefore );
		delete_option( Activator::UPGRADE_LOCK );
		unset( $GLOBALS['current_screen'], $_SERVER['HTTP_X_FORWARDED_FOR'] );
		$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
		parent::tearDown();
	}

	private function put( array $body ): \WP_REST_Response {
		$request = new \WP_REST_Request( 'PUT', '/subtleforms/v1/settings' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body( wp_json_encode( $body ) );
		return rest_do_request( $request );
	}

	public function test_the_moved_payment_fields_are_not_registered_by_free() {
		$registry = \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Fields\FieldRegistry::class );
		foreach ( array( 'payment_amount', 'payment_summary', 'payment_coupon', 'payment_hidden_price' ) as $type ) {
			$this->assertFalse( $registry->has( $type ), $type );
			$this->assertContains( $type, \SubtleForms\Fields\AddonFieldTypes::missing( $registry ) );
		}
	}

	public function test_a_saved_form_with_required_payment_fields_still_submits_without_pro() {
		$form = $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'a', 'key' => 'amount', 'type' => 'payment_amount', 'label' => 'Amount', 'required' => true, 'min' => 5 ),
				array( 'id' => 'c', 'key' => 'coupon', 'type' => 'payment_coupon', 'label' => 'Coupon', 'required' => true ),
				array( 'id' => 'f', 'key' => 'fee', 'type' => 'payment_hidden_price', 'label' => 'Fee', 'amount' => 2 ),
				array( 'id' => 's', 'key' => 'summary', 'type' => 'payment_summary', 'label' => 'Summary' ),
			)
		);
		// The live form leaves the four fields out.
		$public = rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $form . '/schema' ) )->get_data();
		$types  = array_column( $public['data']['schema']['fields'] ?? array(), 'type' );
		$this->assertSame( array( 'text' ), $types );

		// A submission that skips them, or sends a crafted value, is accepted and stores neither.
		$result = $this->submit( $form, array( 'name' => 'Ada', 'amount' => 1, 'coupon' => 'FREE', 'fee' => 9, 'summary' => 9 ) );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$payload = $this->storedPayload( $form );
		$this->assertSame( 'Ada', $payload['name'] ?? null );
		foreach ( array( 'amount', 'coupon', 'fee', 'summary' ) as $key ) {
			$this->assertArrayNotHasKey( $key, $payload );
		}
		$result = $this->submit( $form, array( 'name' => 'Grace' ) );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
	}

	public function test_no_payments_code_is_hinted_for_fields_nobody_registers() {
		$schema = array( 'fields' => array(
			array( 'type' => 'date', 'key' => 'd' ),
			array( 'type' => 'payment_product', 'key' => 'p' ),
			array( 'type' => 'payment_summary', 'key' => 's' ),
			array( 'type' => 'payment_amount', 'key' => 'a' ),
		) );
		$this->assertSame( array( 'date' ), \SubtleForms\Frontend\FrontendAssets::fieldGroups( $schema ) );
	}

	public function test_proxy_settings_save_and_bad_ranges_are_refused() {
		$this->asAdmin();
		$ok = $this->put( array( 'trusted_proxy_cidrs' => array( '10.0.0.0/8', '192.168.1.5' ), 'trust_cloudflare' => true ) );
		$this->assertSame( 200, $ok->get_status(), wp_json_encode( $ok->get_data() ) );
		$saved = get_option( 'subtleforms_settings' );
		$this->assertSame( array( '10.0.0.0/8', '192.168.1.5' ), $saved['trusted_proxy_cidrs'] );
		$this->assertTrue( $saved['trust_cloudflare'] );

		$bad = $this->put( array( 'trusted_proxy_cidrs' => array( '10.0.0.0/8', 'banana' ) ) );
		$this->assertSame( 400, $bad->get_status() );
		$this->assertSame( array( '10.0.0.0/8', '192.168.1.5' ), get_option( 'subtleforms_settings' )['trusted_proxy_cidrs'], 'a refused save changes nothing' );

		$off = $this->put( array( 'trusted_proxy_cidrs' => array(), 'trust_cloudflare' => false ) );
		$this->assertSame( 200, $off->get_status() );
		$this->assertSame( array(), get_option( 'subtleforms_settings' )['trusted_proxy_cidrs'] );
	}

	public function test_the_saved_proxy_list_changes_the_visitor_address() {
		$this->asAdmin();
		$this->put( array( 'trusted_proxy_cidrs' => array( '10.0.0.0/8' ) ) );
		$_SERVER['REMOTE_ADDR']          = '10.1.2.3';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.7';
		$this->assertSame( '198.51.100.7', \SubtleForms\Security\ClientIp::get() );
		$this->put( array( 'trusted_proxy_cidrs' => array() ) );
		$this->assertSame( '10.1.2.3', \SubtleForms\Security\ClientIp::get() );
	}

	/** A site updated by FTP never ran the activation hook: the first admin page load upgrades it. */
	public function test_a_site_updated_by_ftp_gets_its_schema_on_the_first_admin_load() {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_form_schemas';
		$this->assertNotEmpty( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) );

		// Simulate the update: older version stored, one table missing.
		$wpdb->query( "DROP TABLE {$table}" );
		update_option( 'subtleforms_db_version', '2.6.0' );

		// A visitor's request does not touch the schema.
		set_current_screen( 'front' );
		Activator::maybe_upgrade(); // What the admin_init hook runs.
		$this->assertSame( '2.6.0', get_option( 'subtleforms_db_version' ) );
		$this->assertEmpty( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) );

		// The first admin page does.
		set_current_screen( 'dashboard' );
		Activator::maybe_upgrade(); // What the admin_init hook runs.
		$this->assertSame( SUBTLEFORMS_VERSION, get_option( 'subtleforms_db_version' ) );
		$this->assertNotEmpty( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ), 'schema table is back' );
		$this->assertFalse( get_option( Activator::UPGRADE_LOCK ), 'lock released' );
	}

	public function test_the_upgrade_is_hooked_on_admin_init() {
		$this->assertNotFalse( has_action( 'admin_init' ), 'something is hooked' );
		$found = false;
		global $wp_filter;
		foreach ( $wp_filter['admin_init']->callbacks[1] ?? array() as $cb ) {
			if ( $cb['function'] instanceof \Closure && ( new \ReflectionFunction( $cb['function'] ) )->getFileName() === SUBTLEFORMS_PLUGIN_FILE ) {
				$found = true;
			}
		}
		$this->assertTrue( $found, 'subtleforms.php hooks maybe_upgrade on admin_init at priority 1' );
	}

	public function test_the_admin_screen_does_not_load_the_dead_stylesheets() {
		$this->asAdmin();
		set_current_screen( 'dashboard' );
		\SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Admin\AdminMenu::class )->enqueue_assets( 'toplevel_page_subtleforms' );
		$this->assertFalse( wp_style_is( 'subtleforms-admin-builder', 'registered' ) );
		foreach ( wp_styles()->registered as $style ) {
			$this->assertStringNotContainsString( 'assets/css/admin', (string) $style->src );
		}
	}

	public function test_the_editor_loader_carries_the_preview_translations_on_the_lazy_path() {
		global $post;
		$post = self::factory_post();
		setup_postdata( $post );
		wp_scripts()->remove( 'subtleforms-block-editor-loader' );
		\SubtleForms\Blocks\SubtleFormsBlock::enqueue_editor_assets();
		$this->assertTrue( wp_script_is( 'subtleforms-frontend-preview', 'registered' ), 'handle registered so translations can be attached' );
		$this->assertFalse( wp_script_is( 'subtleforms-frontend-preview', 'enqueued' ), 'still lazy' );
		$this->assertContains( 'wp-i18n', wp_scripts()->registered['subtleforms-block-editor-loader']->deps );
		$inline = implode( "\n", (array) wp_scripts()->get_data( 'subtleforms-block-editor-loader', 'after' ) );
		$this->assertStringContainsString( 'subtleforms:frontend-ready', $inline );
		$this->assertSame( 'subtleforms', wp_scripts()->registered['subtleforms-frontend-preview']->textdomain );
	}

	private static function factory_post(): \WP_Post {
		$id = wp_insert_post( array( 'post_title' => 'No form here', 'post_content' => 'Plain text', 'post_status' => 'draft' ) );
		return get_post( $id );
	}
}
