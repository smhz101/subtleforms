<?php
/**
 * Email step log details: preview text and From value (GH119-04).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Actions\EmailAction;

/**
 * @coversNothing
 */
final class EmailLogDetailsTest extends TestCase {

	public function test_html_preview_is_readable_text(): void {
		$html = '<p>Hello,</p><br /><table cellpadding="4"><tr><td>Name</td><td>Ada &amp; Bob</td></tr></table>';
		$out  = EmailAction::previewText( $html, true );
		$this->assertStringNotContainsString( '<', $out );
		$this->assertStringContainsString( "Hello,\n", $out );
		$this->assertStringContainsString( 'Name Ada & Bob', $out );
	}

	public function test_preview_cuts_at_300_chars_with_ellipsis_only_when_cut(): void {
		$this->assertSame( str_repeat( 'a', 300 ) . '…', EmailAction::previewText( str_repeat( 'a', 301 ), false ) );
		$this->assertSame( str_repeat( 'é', 300 ), EmailAction::previewText( str_repeat( 'é', 300 ), false ) );
	}

	public function test_from_uses_header_else_wordpress_default(): void {
		$this->assertSame( 'Me <me@x.test>', EmailAction::fromValue( array( 'From: Me <me@x.test>' ), 'https://www.site.test/' ) );
		$this->assertSame( 'WordPress <wordpress@site.test>', EmailAction::fromValue( array(), 'https://www.site.test/' ) );
	}

	public function test_header_value(): void {
		$this->assertSame( 'a@b.test', EmailAction::headerValue( array( 'Reply-To: a@b.test' ), 'Reply-To' ) );
		$this->assertSame( '', EmailAction::headerValue( array(), 'Reply-To' ) );
	}
}
