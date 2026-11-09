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
		unset( $_POST['subtleforms_classic'], $_POST['subtleforms_form_id'], $_POST['subtleforms_nonce'], $_POST['data'], $_SERVER['REQUEST_METHOD'] );
		wp_set_current_user( 0 );
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

	/** Posts a classic submission for the form and returns the id of the saved entry. */
	private function classicPost( int $formId, string $nonce = null ): int {
		global $wpdb;
		$_SERVER['REQUEST_METHOD']    = 'POST';
		$_SERVER['REQUEST_URI']       = '/a-page/';
		$_POST['subtleforms_classic'] = '1';
		$_POST['subtleforms_form_id'] = (string) $formId;
		if ( null !== $nonce ) {
			$_POST['subtleforms_nonce'] = $nonce;
		}
		$_POST['data'] = array(
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
		try {
			do_action( 'template_redirect' );
			$this->fail( 'The handler should have redirected.' );
		} catch ( \RuntimeException $e ) {
			$this->assertSame( self::STOP, $e->getMessage() );
		}
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ) );
	}

	/** A cross-site post cannot act as the logged-in user: without the nonce it is a guest's. */
	public function test_a_logged_in_post_without_a_nonce_is_stored_as_a_guest(): void {
		global $wpdb;
		if ( ! \SubtleForms\Privacy\PrivacyLookup::hasUserIdColumn() ) {
			$this->markTestSkipped( 'No user_id column.' );
		}
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ) ) );
		$userId = self::factory_user( 'subscriber' );
		wp_set_current_user( $userId );

		$id = $this->classicPost( $formId );

		$this->assertGreaterThan( 0, $id, 'The entry was still saved.' );
		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT user_id FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $id ) ) );
		$this->assertSame( $userId, get_current_user_id(), 'Only the submission ran as a guest; the page still renders for the user.' );
	}

	public function test_a_logged_in_post_with_a_wrong_nonce_is_stored_as_a_guest(): void {
		global $wpdb;
		if ( ! \SubtleForms\Privacy\PrivacyLookup::hasUserIdColumn() ) {
			$this->markTestSkipped( 'No user_id column.' );
		}
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ) ) );
		wp_set_current_user( self::factory_user( 'subscriber' ) );

		$id = $this->classicPost( $formId, 'not-a-nonce' );

		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT user_id FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $id ) ) );
	}

	public function test_a_logged_in_post_with_the_nonce_keeps_the_user(): void {
		global $wpdb;
		if ( ! \SubtleForms\Privacy\PrivacyLookup::hasUserIdColumn() ) {
			$this->markTestSkipped( 'No user_id column.' );
		}
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ) ) );
		$userId = self::factory_user( 'subscriber' );
		wp_set_current_user( $userId );

		$id = $this->classicPost( $formId, wp_create_nonce( 'wp_rest' ) );

		$this->assertSame( $userId, (int) $wpdb->get_var( $wpdb->prepare( "SELECT user_id FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $id ) ) );
		$this->assertSame( $userId, get_current_user_id() );
	}
}
