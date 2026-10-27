<?php
// phpcs:disable -- Unit tests; not shipped in production plugin.
namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Security\PublicRoutes;
use SubtleForms\Support\RequestKeys;

/**
 * P1-01: the generic extension points that replace payment code in Free.
 * Each works for any add-on and has no payment vocabulary of its own.
 */
final class GenericExtensionPointsTest extends TestCase {

	protected function tearDown(): void {
		unset(
			$GLOBALS['sf_test_filters']['subtleforms/submission/request_keys'],
			$GLOBALS['sf_test_filters']['subtleforms/rest/public_routes'],
			$GLOBALS['sf_test_filters']['subtleforms/fields/no_answer_types']
		);
		parent::tearDown();
	}

	public function test_request_keys_are_the_plugin_s_own_until_an_add_on_lists_more(): void {
		$this->assertSame( RequestKeys::BUILT_IN, RequestKeys::all() );
		$this->assertFalse( RequestKeys::has( '_payment' ), 'Free knows no payment reference.' );

		$GLOBALS['sf_test_filters']['subtleforms/submission/request_keys'] = static fn( $keys ) => array_merge( $keys, array( '_example', '' ) );
		$this->assertTrue( RequestKeys::has( '_example' ) );
		$this->assertSame(
			array( 'name' => 'Ann', 'website_url' => '' ),
			RequestKeys::stripAddonKeys( array( 'name' => 'Ann', '_example' => 'x', 'website_url' => '' ) ),
			'Only the add-on keys are dropped here; the spam keys are removed where they are checked.'
		);
	}

	public function test_public_routes_are_the_plugin_s_own_plus_an_add_on_s_exact_routes(): void {
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/submit' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/payments/coupon' ) );

		$GLOBALS['sf_test_filters']['subtleforms/rest/public_routes'] = static fn( $routes ) => array_merge( $routes, array( '/subtleforms/v1/example/check' ) );
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/example/check/' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/example' ) );
	}

	public function test_no_answer_types_come_from_add_ons(): void {
		$this->assertSame( array(), \SubtleForms\Fields\FieldTypeAvailability::noAnswerTypes() );
		$this->assertTrue( \SubtleForms\Support\SchemaValidator::takesAnswer( 'example_summary' ) );
		$GLOBALS['sf_test_filters']['subtleforms/fields/no_answer_types'] = static fn( $types ) => array_merge( $types, array( 'example_summary' ) );
		$this->assertFalse( \SubtleForms\Support\SchemaValidator::takesAnswer( 'example_summary' ) );
		$this->assertTrue( \SubtleForms\Support\SchemaValidator::takesAnswer( 'text' ) );
	}

	public function test_free_ships_no_payment_code(): void {
		$root  = dirname( __DIR__, 2 );
		$this->assertFileDoesNotExist( $root . '/resources/shared/pricing.js' );
		$this->assertFileDoesNotExist( $root . '/resources/shared/currencies.js' );
		$validator = (string) file_get_contents( $root . '/src/Engine/FieldValidator.php' );
		$this->assertStringNotContainsString( 'validatePayment', $validator );
		$submit = (string) file_get_contents( $root . '/src/Api/PublicSubmitApi.php' );
		$this->assertStringNotContainsString( 'payment', strtolower( preg_replace( '/subtleforms\/submit\/(price|finish)_order/', '', $submit ) ) );
	}

	/** RCOMP-01: Free holds no catalogue of an add-on's field types and no payment panel. */
	public function test_free_names_no_add_on_field_types_or_payment_panel(): void {
		$root = dirname( __DIR__, 2 );
		foreach ( array( 'src/Fields/FieldTypeAvailability.php', 'src/Engine/FormRestrictions.php', 'resources/admin/utils/addonFields.js', 'resources/admin/components/AddonFieldsNotice.jsx' ) as $file ) {
			$source = strtolower( (string) file_get_contents( $root . '/' . $file ) );
			$this->assertStringNotContainsString( 'payment_', $source, $file );
			$this->assertStringNotContainsString( 'coupon', $source, $file );
		}
		$transfer = strtolower( (string) file_get_contents( $root . '/src/Tools/TransferPackage.php' ) . (string) file_get_contents( $root . '/src/Tools/TransferService.php' ) );
		$this->assertStringNotContainsString( 'paymentmeta', $transfer );
		$this->assertStringNotContainsString( 'payment_meta', $transfer );
		$detail = (string) file_get_contents( $root . '/resources/admin/pages/SubmissionDetailPage.jsx' );
		$this->assertStringNotContainsString( 'Recorded payment', $detail );
		$this->assertStringNotContainsString( 'meta.payment', $detail );
		$this->assertFileDoesNotExist( $root . '/src/Fields/AddonFieldTypes.php' );
	}
}
