<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Public schema metadata allow-list for required-field settings.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Api\FormsApi;

class PublicSchemaMetaTest extends TestCase {

	public function test_build_public_schema_keeps_required_indicator_meta_and_drops_secrets(): void {
		$api    = ( new ReflectionClass( FormsApi::class ) )->newInstanceWithoutConstructor();
		$method = new ReflectionMethod( FormsApi::class, 'buildPublicSchema' );
		$method->setAccessible( true );

		$public = $method->invoke(
			$api,
			array(
				'fields'   => array(),
				'metadata' => array(
					'validationSummary'     => false,
					'requiredIndicator'     => 'text',
					'requiredIndicatorText' => '(must)',
					'secretStuff'           => 'x',
				),
			)
		);

		$this->assertArrayHasKey( 'metadata', $public );
		$this->assertFalse( $public['metadata']['validationSummary'] );
		$this->assertSame( 'text', $public['metadata']['requiredIndicator'] );
		$this->assertSame( '(must)', $public['metadata']['requiredIndicatorText'] );
		$this->assertArrayNotHasKey( 'secretStuff', $public['metadata'] );
	}
}
