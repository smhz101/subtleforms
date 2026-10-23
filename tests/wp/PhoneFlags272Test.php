<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.7.2 country flags on a live page: the form container lists the `flags`
 * feature, and its code is preloaded, only for a form with a field that shows
 * flags. A form without the setting asks for no flag code at all.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Frontend\FrontendAssets;

final class PhoneFlags272Test extends TestCase {

	/** @var int[] */
	private $postIds = array();

	protected function tearDown(): void {
		foreach ( $this->postIds as $id ) {
			wp_delete_post( $id, true );
		}
		$this->postIds = array();
		parent::tearDown();
	}

	private function freshPage(): void {
		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;
		wp_scripts();
		wp_styles();
		FrontendAssets::resetForTests();
	}

	private function viewPage( string $content ): void {
		$id                  = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Flags', 'post_content' => $content ) );
		$this->postIds[]     = $id;
		$GLOBALS['wp_query'] = new \WP_Query( array( 'page_id' => $id, 'post_type' => 'page' ) );
	}

	private function shortcode( int $formId ): string {
		return \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Frontend\Shortcode::class )->render( array( 'id' => $formId ) );
	}

	private function phoneForm( bool $flags ): int {
		return $this->publish(
			array(
				array( 'id' => 'p', 'key' => 'phone', 'type' => 'phone', 'label' => 'Phone', 'enableCountryCode' => true, 'showFlags' => $flags ),
			)
		);
	}

	public function test_setting_survives_a_save(): void {
		$formId = $this->phoneForm( true );
		$schema = ( new \SubtleForms\Repositories\FormsRepository() )->loadSchemaVersion( $formId );
		$schema = $schema['schema'] ?? $schema;
		$this->assertTrue( $schema['fields'][0]['showFlags'] );
	}

	public function test_container_lists_flags_only_when_a_field_shows_them(): void {
		$on  = $this->phoneForm( true );
		$off = $this->phoneForm( false );
		$this->freshPage();
		$this->viewPage( '<p>Forms</p>' );

		$this->assertStringContainsString( 'data-features="flags geo"', $this->shortcode( $on ) );
		$html = $this->shortcode( $off );
		$this->assertStringContainsString( 'data-features="geo"', $html );
		$this->assertStringNotContainsString( 'flags', $html );
	}

	public function test_flag_code_is_preloaded_only_for_a_form_that_shows_flags(): void {
		$chunks = json_decode( (string) file_get_contents( SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/chunks.json' ), true );
		$this->assertArrayHasKey( 'feature-flags', $chunks );
		$flagsUrl = SUBTLEFORMS_PLUGIN_URL . 'build/frontend/' . $chunks['feature-flags'];

		$off = $this->phoneForm( false );
		$this->freshPage();
		$this->viewPage( '[subtleforms id="' . $off . '"]' );
		do_action( 'wp_enqueue_scripts' );
		$hrefs = wp_list_pluck( apply_filters( 'wp_preload_resources', array() ), 'href' );
		$this->assertNotContains( $flagsUrl, $hrefs );
		$this->assertEmpty( preg_grep( '/flags/', $hrefs ) );

		$on = $this->phoneForm( true );
		$this->freshPage();
		$this->viewPage( '[subtleforms id="' . $on . '"]' );
		do_action( 'wp_enqueue_scripts' );
		$hrefs = wp_list_pluck( apply_filters( 'wp_preload_resources', array() ), 'href' );
		$this->assertContains( $flagsUrl, $hrefs );
	}

	public function test_admin_receives_the_sprite_address(): void {
		$php = (string) file_get_contents( SUBTLEFORMS_PLUGIN_DIR . 'src/Admin/AdminMenu.php' );
		$this->assertStringContainsString( "'flagSpriteUrl'  => SUBTLEFORMS_PLUGIN_URL . 'build/frontend/flags.svg'", $php );
	}
}
