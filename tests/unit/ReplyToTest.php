<?php
/**
 * Reply-To may take a merge tag; the answer is used only when it is one
 * valid address, and it can never add a header of its own (2.6.0).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\ReplyTo;

/**
 * @covers \SubtleForms\Support\ReplyTo
 */
final class ReplyToTest extends TestCase {

	/**
	 * A renderer that puts this answer where {field:email} is.
	 *
	 * @param string $answer Answer.
	 * @return callable
	 */
	private static function answer( string $answer ): callable {
		return static function ( string $text ) use ( $answer ): string {
			return (string) preg_replace( '/\{\{?\s*field:email\s*\}?\}/', $answer, $text );
		};
	}

	public function test_one_valid_answer_is_the_reply_to(): void {
		$this->assertSame( 'ada@example.com', ReplyTo::resolve( '{field:email}', self::answer( 'ada@example.com' ) ) );
		$this->assertSame( 'ada@example.com', ReplyTo::resolve( '{{field:email}}', self::answer( ' ada@example.com ' ) ) );
		$this->assertSame( 'owner@example.com', ReplyTo::resolve( 'owner@example.com', self::answer( 'x' ) ), 'A plain address needs no tag.' );
	}

	/**
	 * @dataProvider refused
	 *
	 * @param string $answer What the visitor typed.
	 */
	public function test_anything_but_one_address_is_dropped( string $answer ): void {
		$this->assertNull( ReplyTo::resolve( '{field:email}', self::answer( $answer ) ) );
	}

	/**
	 * @return array<string, array{0: string}>
	 */
	public static function refused(): array {
		return array(
			'header injection with CRLF' => array( "a@b.com\r\nBcc: x@y.com" ),
			'header injection with LF'   => array( "a@b.com\nBcc: x@y.com" ),
			'header injection, no break' => array( 'a@b.com Bcc: x@y.com' ),
			'two addresses'              => array( 'a@b.com, c@d.com' ),
			'two addresses with ;'       => array( 'a@b.com;c@d.com' ),
			'display name'               => array( 'Ada <a@b.com>' ),
			'empty'                      => array( '' ),
			'spaces only'                => array( '   ' ),
			'not an address'             => array( 'hello' ),
			'tag left unfilled'          => array( '{field:email}' ),
		);
	}

	public function test_header_lines_reply_to_resolved_from_with_a_tag_dropped(): void {
		$result = ReplyTo::apply(
			array( 'From: {field:email}', 'Reply-To: {field:email}', 'Cc: team@example.com' ),
			'',
			self::answer( 'ada@example.com' )
		);
		$this->assertSame( array( 'Reply-To: ada@example.com', 'Cc: team@example.com' ), $result['headers'] );
		$this->assertSame( array( 'From: {field:email}' ), $result['dropped'], 'From never takes a merge tag.' );

		$injected = ReplyTo::apply( array( 'Reply-To: {field:email}' ), '', self::answer( "a@b.com\r\nBcc: x@y.com" ) );
		$this->assertSame( array(), $injected['headers'] );
		$this->assertSame( array( 'Reply-To: {field:email}' ), $injected['dropped'] );
	}

	public function test_the_reply_to_setting_replaces_header_lines(): void {
		$result = ReplyTo::apply( array( 'Reply-To: old@example.com', 'From: Shop <shop@example.com>' ), '{field:email}', self::answer( 'ada@example.com' ) );
		$this->assertSame( array( 'From: Shop <shop@example.com>', 'Reply-To: ada@example.com' ), $result['headers'] );

		$bad = ReplyTo::apply( array( 'From: Shop <shop@example.com>' ), '{field:email}', self::answer( 'a@b.com, c@d.com' ) );
		$this->assertSame( array( 'From: Shop <shop@example.com>' ), $bad['headers'], 'Two addresses: no Reply-To at all.' );
		$this->assertSame( array( 'Reply-To: {field:email}' ), $bad['dropped'] );

		$empty = ReplyTo::apply( array( 'Reply-To: kept@example.com' ), '   ', self::answer( '' ) );
		$this->assertSame( array( 'Reply-To: kept@example.com' ), $empty['headers'], 'An empty setting changes nothing.' );
	}
}
