<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.6.0 front-end speed: the form assets are enqueued only where a form is
 * shown, found early when possible (shortcode, block, widget), at render time
 * otherwise, and printed late when a form renders after the footer scripts.
 * The script is deferred, the container lists the field code groups the form
 * needs, and visitors get a preload hint for the form's data.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Frontend\FormDetector;
use SubtleForms\Frontend\FrontendAssets;

final class FrontEndSpeed260Test extends TestCase {

	/** @var int[] */
	private $postIds = array();

	/** @var callable[] */
	private $filters = array();

	protected function setUp(): void {
		parent::setUp();
		$this->freshPage();
	}

	protected function tearDown(): void {
		foreach ( $this->postIds as $id ) {
			wp_delete_post( $id, true );
		}
		$this->postIds = array();
		foreach ( $this->filters as list( $hook, $callback ) ) {
			remove_filter( $hook, $callback, 10 );
		}
		$this->filters = array();
		global $wp_actions, $_wp_sidebars_widgets;
		unset( $wp_actions['wp_print_footer_scripts'], $wp_actions['wp_footer'] );
		$_wp_sidebars_widgets = array();
		FrontendAssets::resetForTests();
		$GLOBALS['wp_query'] = $GLOBALS['wp_the_query'];
		parent::tearDown();
	}

	/** A fresh script and style queue, as at the start of a page view. */
	private function freshPage(): void {
		$GLOBALS['wp_scripts'] = null;
		$GLOBALS['wp_styles']  = null;
		wp_scripts();
		wp_styles();
		FrontendAssets::resetForTests();
	}

	private function filter( string $hook, callable $callback ): void {
		add_filter( $hook, $callback, 10, 1 );
		$this->filters[] = array( $hook, $callback );
	}

	/** Make the main query show one page with this content. */
	private function viewPage( string $content ): int {
		$id              = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_title'   => 'Speed test',
				'post_content' => $content,
			)
		);
		$this->postIds[] = $id;
		$GLOBALS['wp_query'] = new \WP_Query(
			array(
				'page_id'   => $id,
				'post_type' => 'page',
			)
		);
		return $id;
	}

	/**
	 * Render [subtleforms id="N"] through its registered callback. (The
	 * shortcode table is not filled in this test process, so do_shortcode()
	 * cannot be used here; the callback is the same.)
	 */
	private function shortcode( int $formId ): string {
		return \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Frontend\Shortcode::class )->render( array( 'id' => $formId ) );
	}

	private function formAssetsEnqueued(): bool {
		return wp_script_is( 'subtleforms-frontend', 'enqueued' ) && wp_style_is( 'subtleforms-frontend', 'enqueued' );
	}

	private function contactForm(): int {
		return $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'e', 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
			)
		);
	}

	public function test_page_without_a_form_enqueues_nothing(): void {
		$this->contactForm();
		$this->viewPage( '<!-- wp:paragraph --><p>Just text.</p><!-- /wp:paragraph -->' );
		do_action( 'wp_enqueue_scripts' );
		apply_filters( 'the_content', '<p>Just text.</p>' );

		$this->assertFalse( wp_script_is( 'subtleforms-frontend', 'enqueued' ) );
		$this->assertFalse( wp_style_is( 'subtleforms-frontend', 'enqueued' ) );
		$this->assertSame( array(), apply_filters( 'wp_preload_resources', array() ) );
	}

	public function test_shortcode_in_the_post_is_found_before_the_head(): void {
		$formId = $this->contactForm();
		$this->viewPage( '<p>Contact us</p>[subtleforms id="' . $formId . '"]' );
		do_action( 'wp_enqueue_scripts' );

		$this->assertTrue( $this->formAssetsEnqueued() );
		$this->assertSame( 'defer', wp_scripts()->get_data( 'subtleforms-frontend', 'strategy' ) );
		// The page carries the form's data (2.6.1), so no hint to fetch it.
		$this->assertNotContains( FrontendAssets::schemaUrl( $formId ), wp_list_pluck( apply_filters( 'wp_preload_resources', array() ), 'href' ) );
	}

	public function test_schema_is_preloaded_when_the_page_does_not_carry_it(): void {
		$formId = $this->contactForm();
		$off    = '__return_false';
		add_filter( 'subtleforms/frontend/inline_form_data', $off );
		$this->viewPage( '<p>Contact us</p>[subtleforms id="' . $formId . '"]' );
		do_action( 'wp_enqueue_scripts' );
		remove_filter( 'subtleforms/frontend/inline_form_data', $off );

		$this->assertContains( FrontendAssets::schemaUrl( $formId ), wp_list_pluck( apply_filters( 'wp_preload_resources', array() ), 'href' ) );
	}

	public function test_block_in_the_post_is_found_before_the_head(): void {
		$formId = $this->contactForm();
		$this->viewPage( '<!-- wp:group --><div class="wp-block-group"><!-- wp:subtleforms/form {"formId":' . $formId . '} /--></div><!-- /wp:group -->' );
		do_action( 'wp_enqueue_scripts' );

		$this->assertTrue( $this->formAssetsEnqueued() );
	}

	public function test_unpublished_or_escaped_forms_are_not_enqueued_early(): void {
		$formId = $this->contactForm();
		$this->viewPage( 'Write [[subtleforms id="' . $formId . '"]] to show a form. [subtleforms id="999999"]' );
		do_action( 'wp_enqueue_scripts' );

		$this->assertFalse( wp_script_is( 'subtleforms-frontend', 'enqueued' ) );
	}

	public function test_block_widget_is_found_before_the_head(): void {
		$formId = $this->contactForm();
		$this->viewPage( '<p>No form in the post.</p>' );
		register_sidebar( array( 'id' => 'sf-speed-test', 'name' => 'Speed test' ) );
		$this->filter(
			'sidebars_widgets',
			static function ( $widgets ) {
				$widgets                    = is_array( $widgets ) ? $widgets : array();
				$widgets['sf-speed-test'] = array( 'block-90210' );
				return $widgets;
			}
		);
		$this->filter(
			'option_widget_block',
			static function ( $value ) use ( $formId ) {
				$value          = is_array( $value ) ? $value : array();
				$value[90210] = array( 'content' => '<!-- wp:subtleforms/form {"formId":' . $formId . '} /-->' );
				return $value;
			}
		);
		$this->assertSame( array( $formId ), FormDetector::formIdsInWidgets() );

		do_action( 'wp_enqueue_scripts' );
		unregister_sidebar( 'sf-speed-test' );

		$this->assertTrue( $this->formAssetsEnqueued() );
	}

	public function test_form_rendered_from_a_template_gets_its_assets_at_render_time(): void {
		$formId = $this->contactForm();
		$this->viewPage( '<p>No form in the post.</p>' );
		do_action( 'wp_enqueue_scripts' );
		$this->assertFalse( wp_script_is( 'subtleforms-frontend', 'enqueued' ) );

		// As a theme template calling do_shortcode() would.
		$html = $this->shortcode( $formId );

		$this->assertStringContainsString( 'class="subtleforms-form-container" data-form-id="' . $formId . '"', $html );
		$this->assertTrue( $this->formAssetsEnqueued() );
	}

	public function test_block_rendered_without_detection_gets_its_assets(): void {
		$formId = $this->contactForm();
		$this->viewPage( '<p>No form in the post.</p>' );
		$html = do_blocks( '<!-- wp:subtleforms/form {"formId":' . $formId . '} /-->' );

		$this->assertStringContainsString( 'subtleforms-block', $html );
		$this->assertTrue( $this->formAssetsEnqueued() );
	}

	public function test_form_rendered_after_the_footer_scripts_is_printed_late(): void {
		$formId = $this->contactForm();
		$this->viewPage( '<p>No form in the post.</p>' );
		// The footer scripts are already out, as with a popup printed at the
		// end of wp_footer.
		do_action( 'wp_print_footer_scripts' );

		$this->shortcode( $formId );
		$this->assertNotFalse( has_action( 'shutdown', array( FrontendAssets::class, 'printLate' ) ) );

		ob_start();
		FrontendAssets::printLate();
		$out = (string) ob_get_clean();
		$this->assertStringContainsString( 'build/frontend/frontend.js', $out );
		$this->assertStringContainsString( 'build/frontend/index.jsx.css', $out );
		$this->assertStringContainsString( 'subtleformsFrontend', $out );
	}

	public function test_normal_page_does_not_schedule_a_late_print(): void {
		$formId = $this->contactForm();
		$this->viewPage( '[subtleforms id="' . $formId . '"]' );
		do_action( 'wp_enqueue_scripts' );
		$this->shortcode( $formId );

		$this->assertFalse( has_action( 'shutdown', array( FrontendAssets::class, 'printLate' ) ) );
	}

	public function test_container_lists_the_field_code_the_form_needs(): void {
		$plain   = $this->contactForm();
		$special = $this->publish(
			array(
				array( 'id' => 'd', 'key' => 'when', 'type' => 'date', 'label' => 'Date' ),
				array( 'id' => 'p', 'key' => 'phone', 'type' => 'phone', 'label' => 'Phone', 'enableCountryCode' => true ),
				array( 'id' => 'u', 'key' => 'cv', 'type' => 'file_upload', 'label' => 'CV' ),
			)
		);
		$this->viewPage( '<p>Forms</p>' );

		$this->assertStringNotContainsString( 'data-features', $this->shortcode( $plain ) );
		$this->assertStringContainsString( 'data-features="date geo upload"', $this->shortcode( $special ) );
		$this->assertStringContainsString( 'data-features="date geo upload"', do_blocks( '<!-- wp:subtleforms/form {"formId":' . $special . '} /-->' ) );
	}

	public function test_field_code_is_preloaded_only_for_forms_that_need_it(): void {
		$plain   = $this->contactForm();
		$special = $this->publish(
			array(
				array( 'id' => 'd', 'key' => 'when', 'type' => 'date', 'label' => 'Date' ),
				array( 'id' => 'k', 'key' => 'country', 'type' => 'country', 'label' => 'Country' ),
			)
		);
		$this->viewPage( '[subtleforms id="' . $plain . '"]' );
		do_action( 'wp_enqueue_scripts' );
		$scripts = wp_list_filter( apply_filters( 'wp_preload_resources', array() ), array( 'as' => 'script' ) );
		$this->assertSame( array(), $scripts );

		$this->freshPage();
		$this->viewPage( '[subtleforms id="' . $special . '"]' );
		do_action( 'wp_enqueue_scripts' );
		$hrefs = wp_list_pluck( wp_list_filter( apply_filters( 'wp_preload_resources', array() ), array( 'as' => 'script' ) ), 'href' );
		$this->assertCount( 2, $hrefs );
		$chunks = json_decode( (string) file_get_contents( SUBTLEFORMS_PLUGIN_DIR . 'build/frontend/chunks.json' ), true );
		$this->assertContains( SUBTLEFORMS_PLUGIN_URL . 'build/frontend/' . $chunks['field-date'], $hrefs );
		$this->assertContains( SUBTLEFORMS_PLUGIN_URL . 'build/frontend/' . $chunks['field-phone-country'], $hrefs );
	}

	public function test_login_only_form_gets_its_assets_but_no_preload(): void {
		$schema = array(
			'metadata'       => array(
				'type'         => 'regular',
				'title'        => 'Members',
				'restrictions' => array( 'requireLogin' => true ),
			),
			'schema_version' => 1,
			'fields'         => array( array( 'id' => 'd', 'key' => 'when', 'type' => 'date', 'label' => 'Date' ) ),
		);
		$repo   = new \SubtleForms\Repositories\FormsRepository();
		$formId = $repo->create( array( 'title' => 'Members', 'status' => 'published', 'schema' => $schema ) );
		$repo->saveSchemaVersion( $formId, $schema, true );
		$this->formIds[] = $formId;

		$this->viewPage( '[subtleforms id="' . $formId . '"]' );
		do_action( 'wp_enqueue_scripts' );

		// The login message is styled, so the assets load; the form does not
		// load, so nothing is preloaded for it.
		$this->assertTrue( $this->formAssetsEnqueued() );
		$this->assertSame( array(), apply_filters( 'wp_preload_resources', array() ) );
	}

	public function test_field_code_translations_are_added_to_the_form_script(): void {
		$formId = $this->publish( array( array( 'id' => 'd', 'key' => 'when', 'type' => 'date', 'label' => 'Date' ) ) );
		$this->viewPage( '<p>Form below</p>' );
		$json = '{"locale_data":{"messages":{"":{"domain":"messages"},"Select a date":["Datum wählen"]}}}';
		$seen   = array();
		$filter = static function ( $translations, $file, $handle ) use ( $json, &$seen ) {
			$seen[] = $handle;
			return 'subtleforms-frontend-field-date' === $handle ? $json : $translations;
		};
		add_filter( 'pre_load_script_translations', $filter, 10, 3 );
		$this->shortcode( $formId );
		$this->shortcode( $formId );
		remove_filter( 'pre_load_script_translations', $filter, 10 );

		$before = (array) wp_scripts()->get_data( 'subtleforms-frontend', 'before' );
		$this->assertCount( 1, array_filter( $before, static function ( $code ) {
			return is_string( $code ) && false !== strpos( $code, 'Datum wählen' );
		} ) );
		$this->assertSame( array( 'subtleforms-frontend-field-date' ), $seen );
	}

	public function test_logged_in_users_get_no_preload_hint(): void {
		$formId = $this->contactForm();
		wp_set_current_user( 1 );
		$this->viewPage( '[subtleforms id="' . $formId . '"]' );
		do_action( 'wp_enqueue_scripts' );

		$this->assertTrue( $this->formAssetsEnqueued() );
		$this->assertSame( array(), apply_filters( 'wp_preload_resources', array() ) );
	}

	public function test_preload_url_matches_the_script_request(): void {
		$this->assertSame( rtrim( rest_url( 'subtleforms/v1' ), '/' ) . '/forms/12/schema', FrontendAssets::schemaUrl( 12 ) );
		$lang = static function () {
			return 'de';
		};
		add_filter( 'subtleforms/frontend/language', $lang );
		$url = FrontendAssets::schemaUrl( 12 );
		remove_filter( 'subtleforms/frontend/language', $lang );
		$this->assertStringEndsWith( '/forms/12/schema' . ( false === strpos( rest_url(), '?' ) ? '?' : '&' ) . 'lang=de', $url );
	}
}
