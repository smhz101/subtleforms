<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Tools moved into Settings as a tab: the old admin URL opens that tab.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Support\Capabilities;

final class ToolsTabRedirectTest extends TestCase {

	/** @var int|null */
	private $previousUser;

	protected function setUp(): void {
		parent::setUp();
		$this->previousUser = get_current_user_id();
	}

	protected function tearDown(): void {
		unset( $_GET['page'] );
		remove_all_filters( 'wp_redirect' );
		wp_set_current_user( (int) $this->previousUser );
		parent::tearDown();
	}

	/** Run the redirect and give back where it went, or null when it did not redirect. */
	private function redirectFor( string $page ): ?string {
		$_GET['page'] = $page;
		add_filter(
			'wp_redirect',
			static function ( $location ) {
				throw new \RuntimeException( (string) $location );
			}
		);
		$menu = ( new \ReflectionClass( AdminMenu::class ) )->newInstanceWithoutConstructor();
		( new \ReflectionProperty( AdminMenu::class, 'caps' ) )->setValue( $menu, new Capabilities() );
		try {
			$menu->redirect_legacy_pages();
		} catch ( \RuntimeException $e ) {
			return $e->getMessage();
		}
		return null;
	}

	private function admin(): void {
		$ids = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ) );
		$this->assertNotEmpty( $ids, 'The test site needs an administrator.' );
		wp_set_current_user( (int) $ids[0] );
	}

	public function test_the_tools_tab_url_is_the_settings_page_with_the_tools_tab(): void {
		$this->assertSame( admin_url( 'admin.php?page=subtleforms-settings#tab=tools' ), AdminMenu::tools_tab_url() );
	}

	public function test_the_old_tools_url_opens_the_tools_tab_for_an_admin(): void {
		$this->admin();
		$this->assertSame( AdminMenu::tools_tab_url(), $this->redirectFor( 'subtleforms-tools' ) );
	}

	public function test_other_pages_are_left_alone(): void {
		$this->admin();
		$this->assertNull( $this->redirectFor( 'subtleforms-settings' ) );
		$this->assertNull( $this->redirectFor( 'subtleforms-submissions' ) );
	}

	public function test_a_visitor_without_the_capability_is_not_redirected(): void {
		wp_set_current_user( 0 );
		$this->assertNull( $this->redirectFor( 'subtleforms-tools' ) );
	}

	public function test_the_menu_no_longer_registers_a_tools_item(): void {
		$source = file_get_contents( SUBTLEFORMS_PLUGIN_DIR . 'src/Admin/AdminMenu.php' );
		$this->assertStringNotContainsString( "'subtleforms-tools',\n\t\t\tarray", $source );
		$this->assertDoesNotMatchRegularExpression( '/add_submenu_page\([^;]*subtleforms-tools/s', $source );
	}
}
