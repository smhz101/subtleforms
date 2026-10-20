<?php
/**
 * UX2-27: reserved form height before React mounts.
 */

declare(strict_types=1);

namespace SubtleForms\Tests\Unit\Frontend;

use PHPUnit\Framework\TestCase;
use SubtleForms\Frontend\Shortcode;

final class FormReserveHeightTest extends TestCase {

	public function test_empty_schema_still_reserves_a_floor(): void {
		$this->assertSame( 120, Shortcode::reserveHeight( array() ) );
	}

	public function test_height_grows_with_visible_fields_and_caps(): void {
		$fields = array();
		for ( $i = 0; $i < 3; $i++ ) {
			$fields[] = array(
				'type'   => 'text',
				'key'    => 'f' . $i,
				'config' => array( 'label' => 'Field' ),
			);
		}
		$height = Shortcode::reserveHeight( array( 'fields' => $fields ) );
		$this->assertSame( 96 + ( 3 * 72 ), $height );

		$many = array();
		for ( $i = 0; $i < 50; $i++ ) {
			$many[] = array( 'type' => 'text', 'key' => 'x' . $i );
		}
		$this->assertSame( 960, Shortcode::reserveHeight( array( 'fields' => $many ) ) );
	}

	public function test_hidden_fields_do_not_inflate_height(): void {
		$schema = array(
			'fields' => array(
				array( 'type' => 'hidden', 'key' => 'h' ),
				array( 'type' => 'text', 'key' => 't' ),
			),
		);
		$this->assertSame( 96 + 72, Shortcode::reserveHeight( $schema ) );
	}
}
