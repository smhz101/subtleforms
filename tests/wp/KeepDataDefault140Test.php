<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Support\UninstallDefaults;

/**
 * 2.10.0 (#140): new sites keep their data when the plugin is deleted, and the
 * Plugins screen row says what deleting does.
 */
final class KeepDataDefault140Test extends TestCase {

	/** @var mixed */
	private $settingsBefore;

	protected function setUp(): void {
		parent::setUp();
		$this->settingsBefore = get_option( 'subtleforms_settings', null );
	}

	protected function tearDown(): void {
		null === $this->settingsBefore ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $this->settingsBefore );
		parent::tearDown();
	}

	private function asRole( string $role ): void {
		$id = wp_insert_user( array( 'user_login' => 'kd140_' . $role . wp_generate_password( 6, false ), 'user_pass' => wp_generate_password(), 'role' => $role ) );
		wp_set_current_user( $id );
	}

	public function test_a_fresh_activation_stores_keep_data_on(): void {
		delete_option( 'subtleforms_settings' );
		UninstallDefaults::afterActivate( true );
		$this->assertTrue( get_option( 'subtleforms_settings' )['keep_data_on_uninstall'] );
		$this->assertTrue( \SubtleForms\Support\Uninstaller::keeps_data() );
	}

	public function test_an_existing_site_without_the_key_stays_off(): void {
		update_option( 'subtleforms_settings', array( 'sender_name' => 'Shop' ) );
		UninstallDefaults::afterActivate( false );
		$saved = get_option( 'subtleforms_settings' );
		$this->assertArrayNotHasKey( 'keep_data_on_uninstall', $saved );
		$this->assertSame( 'Shop', $saved['sender_name'] );
		$this->assertFalse( \SubtleForms\Support\Uninstaller::keeps_data() );
	}

	public function test_a_stored_false_stays_false(): void {
		update_option( 'subtleforms_settings', array( 'keep_data_on_uninstall' => false ) );
		UninstallDefaults::afterActivate( false );
		$this->assertFalse( get_option( 'subtleforms_settings' )['keep_data_on_uninstall'] );
		UninstallDefaults::afterActivate( true );
		$this->assertFalse( get_option( 'subtleforms_settings' )['keep_data_on_uninstall'] );
	}

	public function test_the_row_shows_the_warning_when_keep_data_is_off(): void {
		update_option( 'subtleforms_settings', array( 'keep_data_on_uninstall' => false ) );
		$this->asAdmin();
		$meta = apply_filters( 'plugin_row_meta', array( 'Version 1' ), SUBTLEFORMS_PLUGIN_BASENAME, array(), '' );
		$this->assertCount( 2, $meta );
		$this->assertStringContainsString( 'Deleting removes all forms and entries.', $meta[1] );
		$this->assertStringContainsString( 'subtleforms-delete-warning', $meta[1] );
		$this->assertStringContainsString( 'color:#d63638', $meta[1] );
		$this->assertStringContainsString( '#tab=advanced', $meta[1] );
		$this->assertStringContainsString( '>Change</a>', $meta[1] );
	}

	public function test_the_row_says_data_is_kept_when_keep_data_is_on(): void {
		update_option( 'subtleforms_settings', array( 'keep_data_on_uninstall' => true ) );
		$this->asAdmin();
		$meta = apply_filters( 'plugin_row_meta', array(), SUBTLEFORMS_PLUGIN_BASENAME, array(), '' );
		$this->assertCount( 1, $meta );
		$this->assertStringContainsString( 'Forms and entries are kept if the plugin is deleted.', $meta[0] );
		$this->assertStringNotContainsString( 'subtleforms-delete-warning', $meta[0] );
		$this->assertStringNotContainsString( '#d63638', $meta[0] );
		$this->assertStringContainsString( '#tab=advanced', $meta[0] );
	}

	public function test_the_row_is_only_for_this_plugin(): void {
		update_option( 'subtleforms_settings', array() );
		$this->asAdmin();
		$meta = apply_filters( 'plugin_row_meta', array( 'x' ), 'other-plugin/other.php', array(), '' );
		$this->assertSame( array( 'x' ), $meta );
	}

	public function test_the_row_is_only_for_users_who_can_delete_plugins(): void {
		update_option( 'subtleforms_settings', array() );
		$this->asRole( 'editor' );
		$this->assertFalse( current_user_can( 'delete_plugins' ) );
		$meta = apply_filters( 'plugin_row_meta', array( 'x' ), SUBTLEFORMS_PLUGIN_BASENAME, array(), '' );
		$this->assertSame( array( 'x' ), $meta );
	}
}
