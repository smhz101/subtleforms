<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Extensions catalog, its filter, the REST route and the menu item.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Extensions\Catalog;
use SubtleForms\Support\Capabilities;

final class ExtensionsCatalogTest extends TestCase {

	protected function tearDown(): void {
		remove_all_filters( 'subtleforms/extensions/catalog' );
		remove_all_filters( 'subtleforms/admin/upgrade_menu_item' );
		parent::tearDown();
	}

	private function bySlug(): array {
		$out = array();
		foreach ( Catalog::entries() as $entry ) {
			$out[ $entry['slug'] ] = $entry;
		}
		return $out;
	}

	private function entry( array $extra = array() ): array {
		return array_merge(
			array(
				'slug'        => 'demo',
				'title'       => 'Demo',
				'description' => 'A demo entry.',
				'category'    => 'site',
				'plan'        => 'pro',
				'icon'        => 'admin-generic',
				'docsUrl'     => '',
				'settingsUrl' => '',
				'source'      => 'addon',
				'status'      => 'active',
				'action'      => null,
			),
			$extra
		);
	}

	public function test_built_in_entries_are_valid_and_complete(): void {
		$entries = Catalog::entries();
		$this->assertCount( 20, $entries );
		$ids = wp_list_pluck( Catalog::categories(), 'id' );
		foreach ( $entries as $e ) {
			$this->assertSame( array( 'slug', 'title', 'description', 'category', 'plan', 'icon', 'docsUrl', 'settingsUrl', 'source', 'status', 'action' ), array_keys( $e ) );
			$this->assertContains( $e['category'], $ids );
			$this->assertNotSame( '', $e['title'] );
			$this->assertStringNotContainsString( "\u{2014}", $e['description'] );
		}
		$this->assertSame( count( $entries ), count( array_unique( wp_list_pluck( $entries, 'slug' ) ) ) );
	}

	public function test_plans_and_statuses(): void {
		$by = $this->bySlug();
		foreach ( array( 'mailchimp', 'brevo', 'kit', 'mailpoet', 'hubspot' ) as $slug ) {
			$this->assertSame( 'free', $by[ $slug ]['plan'] );
			$this->assertSame( 'included', $by[ $slug ]['status'] );
			$this->assertSame( 'settings', $by[ $slug ]['action']['kind'] );
			$this->assertStringContainsString( 'page=subtleforms-settings', $by[ $slug ]['action']['url'] );
		}
		$plans = array( 'starter' => 8, 'pro' => 5, 'agency' => 2 );
		foreach ( $plans as $plan => $count ) {
			$rows = array_filter( $by, static fn( $e ) => $e['plan'] === $plan );
			$this->assertCount( $count, $rows, $plan );
			foreach ( $rows as $e ) {
				$this->assertSame( 'locked', $e['status'] );
				$this->assertSame( 'plans', $e['action']['kind'] );
				$this->assertSame( 'See plans', $e['action']['label'] );
				$this->assertSame( AdminMenu::upgrade_url( 'extensions' ), $e['action']['url'] );
			}
		}
	}

	public function test_filter_can_add_and_modify_an_entry(): void {
		add_filter(
			'subtleforms/extensions/catalog',
			function ( $entries ) {
				$entries[0]['status'] = 'active';
				$entries[]            = $this->entry();
				return $entries;
			}
		);
		$by = $this->bySlug();
		$this->assertSame( 'active', $by['mailchimp']['status'] );
		$this->assertSame( 'Demo', $by['demo']['title'] );
	}

	public function test_invalid_entries_from_the_filter_are_dropped(): void {
		add_filter(
			'subtleforms/extensions/catalog',
			function ( $entries ) {
				$bad = $this->entry();
				unset( $bad['title'] );
				return array_merge(
					$entries,
					array(
						'not an array',
						$bad,
						$this->entry( array( 'slug' => 'bad-plan', 'plan' => 'gold' ) ),
						$this->entry( array( 'slug' => 'bad-status', 'status' => 'broken' ) ),
						$this->entry( array( 'slug' => 'bad-category', 'category' => 'nope' ) ),
						$this->entry( array( 'slug' => 'mailchimp' ) ),
						$this->entry( array( 'slug' => 'good', 'title' => '<b>Good</b>', 'action' => array( 'label' => 'Go', 'url' => 'javascript:alert(1)', 'kind' => 'install' ) ) ),
					)
				);
			}
		);
		$by = $this->bySlug();
		$this->assertCount( 21, $by );
		$this->assertSame( 'Good', $by['good']['title'] );
		$this->assertNull( $by['good']['action'] );
		$this->assertSame( 'Mailchimp', $by['mailchimp']['title'] );
	}

	public function test_filter_returning_a_non_array_leaves_an_empty_list(): void {
		add_filter( 'subtleforms/extensions/catalog', '__return_null' );
		$this->assertSame( array(), Catalog::entries() );
	}

	private function get(): \WP_REST_Response {
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/extensions' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		return rest_do_request( $request );
	}

	public function test_rest_is_forbidden_for_a_subscriber(): void {
		wp_set_current_user( self::factory_user( 'subscriber' ) );
		$this->assertSame( 403, $this->get()->get_status() );
	}

	public function test_rest_returns_the_catalog_to_an_admin(): void {
		$this->asAdmin();
		$res  = $this->get();
		$data = $res->get_data()['data'];
		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( array( 'entries', 'categories', 'hasAddon' ), array_keys( $data ) );
		$this->assertCount( 20, $data['entries'] );
		$this->assertSame( array( 'payments', 'integrations', 'fields', 'entries', 'site' ), wp_list_pluck( $data['categories'], 'id' ) );
		$this->assertIsBool( $data['hasAddon'] );
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

	public function test_menu_order_is_settings_extensions_upgrade(): void {
		add_filter( 'subtleforms/admin/upgrade_menu_item', '__return_true' );
		$slugs = $this->slugs();
		$n     = count( $slugs );
		$this->assertSame( 'subtleforms-settings', $slugs[ $n - 3 ] );
		$this->assertSame( 'subtleforms-extensions', $slugs[ $n - 2 ] );
		$this->assertSame( AdminMenu::upgrade_url( 'menu' ), $slugs[ $n - 1 ] );
	}

	public function test_extensions_is_last_without_the_upgrade_item(): void {
		add_filter( 'subtleforms/admin/upgrade_menu_item', '__return_false' );
		$slugs = $this->slugs();
		$this->assertSame( 'subtleforms-extensions', end( $slugs ) );
	}
}
