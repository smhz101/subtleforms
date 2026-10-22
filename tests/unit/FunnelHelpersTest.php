<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * Form completion funnel (2.6.0): the checks the beacon route runs before
 * anything is counted.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Analytics\Funnel;

final class FunnelHelpersTest extends TestCase {

	private function schema(): array {
		return array(
			'fields' => array(
				array( 'type' => 'step', 'key' => 'step_1', 'config' => array( 'label' => 'About you' ) ),
				array( 'type' => 'text', 'key' => 'name', 'label' => 'Your name' ),
				array(
					'type'    => 'two_column_container',
					'key'     => 'cols',
					'columns' => array(
						array( 'fields' => array( array( 'type' => 'email', 'key' => 'email', 'label' => 'Email' ) ) ),
						array( 'fields' => array( array( 'type' => 'phone', 'key' => 'phone', 'config' => array( 'label' => '<b>Phone</b>' ) ) ) ),
					),
				),
				array( 'type' => 'step', 'key' => 'step_2', 'label' => 'Details' ),
				array( 'type' => 'textarea', 'key' => 'message' ),
			),
		);
	}

	public function test_field_labels_list_answerable_fields_only(): void {
		$labels = Funnel::fieldLabels( $this->schema() );
		$this->assertSame(
			array(
				'name'    => 'Your name',
				'email'   => 'Email',
				'phone'   => 'Phone',
				'message' => 'message',
			),
			$labels,
			'Layout and step nodes are not fields; labels are plain text; a field without a label shows its key.'
		);
		$this->assertSame( 'phone', Funnel::fieldInfo( $this->schema() )['phone']['type'] );
		$this->assertSame( array(), Funnel::fieldLabels( null ) );
	}

	public function test_step_labels_follow_the_step_nodes(): void {
		$this->assertSame( array( 0 => 'About you', 1 => 'Details' ), Funnel::stepLabels( $this->schema() ) );
		$this->assertSame( array(), Funnel::stepLabels( array( 'fields' => array() ) ) );
	}

	public function test_only_keys_of_the_published_form_are_kept(): void {
		$fields = Funnel::fieldLabels( $this->schema() );
		$this->assertSame( 'phone', Funnel::knownKey( 'phone', $fields ) );
		$this->assertSame( '', Funnel::knownKey( 'password', $fields ), 'Unknown key.' );
		$this->assertSame( '', Funnel::knownKey( 'cols', $fields ), 'A layout container is not a field.' );
		$this->assertSame( '', Funnel::knownKey( array( 'phone' ), $fields ) );
		$this->assertSame( '', Funnel::knownKey( null, $fields ) );
		$this->assertSame( '', Funnel::knownKey( str_repeat( 'a', 101 ), array( str_repeat( 'a', 101 ) => 'x' ) ), 'Too long.' );
	}

	public function test_step_index_is_a_small_whole_number(): void {
		$this->assertSame( 0, Funnel::stepIndex( '0' ) );
		$this->assertSame( 12, Funnel::stepIndex( '12' ) );
		$this->assertSame( 3, Funnel::stepIndex( 3 ) );
		$this->assertSame( -1, Funnel::stepIndex( '-1' ) );
		$this->assertSame( -1, Funnel::stepIndex( '100' ) );
		$this->assertSame( -1, Funnel::stepIndex( '1.5' ) );
		$this->assertSame( -1, Funnel::stepIndex( '2; DROP TABLE' ) );
		$this->assertSame( -1, Funnel::stepIndex( null ) );
		$this->assertSame( -1, Funnel::stepIndex( 120 ) );
	}

	public function test_robots_are_recognised(): void {
		$this->assertTrue( Funnel::isBot( '' ) );
		$this->assertTrue( Funnel::isBot( 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' ) );
		$this->assertTrue( Funnel::isBot( 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/130.0 Safari/537.36' ) );
		$this->assertTrue( Funnel::isBot( 'Chrome-Lighthouse' ) );
		$this->assertFalse( Funnel::isBot( 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' ) );
		$this->assertFalse( Funnel::isBot( 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' ) );
	}
}
