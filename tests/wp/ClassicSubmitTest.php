<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * A form post without AJAX goes to the page, not to REST. Its handler must be
 * hooked on a normal front-end request (broken since 2.4.0, when it was hooked
 * from the REST routes only).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Api\PublicSubmitApi;

final class ClassicSubmitTest extends TestCase {

	/** Thrown from the redirect filter so the handler's exit is never reached. */
	private const STOP = 'subtleforms-test-redirect';

	/** @var string|null */
	private $location = null;

	protected function tearDown(): void {
		remove_all_filters( 'wp_redirect' );
		unset( $_POST['subtleforms_classic'], $_POST['subtleforms_form_id'], $_POST['data'], $_SERVER['REQUEST_METHOD'] );
		$_SERVER['REQUEST_URI'] = '/';
		parent::tearDown();
	}

	/** Front-end requests never run rest_api_init, so the hook is there without it. */
	public function test_the_classic_handler_is_hooked_without_a_rest_request(): void {
		$found = false;
		foreach ( (array) ( $GLOBALS['wp_filter']['template_redirect']->callbacks ?? array() ) as $callbacks ) {
			foreach ( $callbacks as $callback ) {
				$fn = $callback['function'];
				if ( $fn instanceof \Closure ) {
					$found = $found || ( new \ReflectionFunction( $fn ) )->getClosureThis() instanceof \SubtleForms\Plugin;
				}
			}
		}
		$this->assertTrue( $found, 'template_redirect carries the plugin handler.' );
		$this->assertNotFalse( has_action( 'template_redirect' ) );
	}

	public function test_a_classic_post_saves_the_entry_and_redirects(): void {
		global $wpdb;
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ) ) );
		wp_set_current_user( 0 );

		$_SERVER['REQUEST_METHOD']   = 'POST';
		$_SERVER['REQUEST_URI']      = '/a-page/';
		$_POST['subtleforms_classic'] = '1';
		$_POST['subtleforms_form_id'] = (string) $formId;
		$_POST['data']                = array(
			'name'             => 'Ada Classic',
			'form_rendered_at' => \SubtleForms\Engine\SpamProtection::issue_token( $formId, time() - 60 - ( ++self::$tokenSeq ) ),
		);

		add_filter(
			'wp_redirect',
			function ( $location ) {
				$this->location = (string) $location;
				throw new \RuntimeException( self::STOP );
			}
		);

		$before = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
		try {
			do_action( 'template_redirect' );
			$this->fail( 'The handler should have redirected.' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( self::STOP, $e->getMessage() );
		}
		$after = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );

		$this->assertSame( $before + 1, $after, 'The entry was saved.' );
		$this->assertNotNull( $this->location, 'A redirect was attempted.' );
		$this->assertStringContainsString( '/a-page/', (string) $this->location, 'The visitor returns to the page, not the home page.' );
		$this->assertSame( 'Ada Classic', $this->storedPayload( $formId )['name'] ?? null );
	}
}
