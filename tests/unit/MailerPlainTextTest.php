<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\Mailer;

final class MailerPlainTextTest extends TestCase {

	public function test_line_breaks_and_blocks() {
		$this->assertSame( "Hi\nthere\nNext", Mailer::plainText( '<p>Hi<br>there</p><p>Next</p>' ) );
		$this->assertSame( "A\nB", Mailer::plainText( "<div>A</div>\n\n\n\n<div>B</div>" ) );
	}

	public function test_nl2br_output_keeps_single_line_breaks() {
		$this->assertSame( "Hello,\n\nYou received a message", Mailer::plainText( nl2br( "Hello,\n\nYou received a message" ) ) );
	}

	public function test_table_rows() {
		$html = '<table><tr><th>Name</th><td>Ann</td></tr><tr><th>Email</th><td>a@b.co</td></tr></table>';
		$this->assertSame( "Name Ann\nEmail a@b.co", Mailer::plainText( $html ) );
	}

	public function test_links() {
		$this->assertSame( 'See Docs (https://x.test/a?b=1&c=2)', Mailer::plainText( '<p>See <a href="https://x.test/a?b=1&amp;c=2">Docs</a></p>' ) );
		$this->assertSame( 'https://x.test', Mailer::plainText( '<a href="https://x.test">https://x.test</a>' ) );
		$this->assertSame( 'Mail me (a@b.co)', Mailer::plainText( '<a href="mailto:a@b.co">Mail me</a>' ) );
		$this->assertSame( 'Click', Mailer::plainText( '<a href="javascript:x()">Click</a>' ) );
	}

	public function test_entities_decoded() {
		$this->assertSame( 'Tom & "Jerry" <3', Mailer::plainText( '<p>Tom &amp; &quot;Jerry&quot; &lt;3</p>' ) );
	}

	public function test_style_script_head_removed() {
		$html = '<html><head><title>T</title></head><body><style>p{color:red}</style><script>x()</script><p>Body</p></body></html>';
		$this->assertSame( 'Body', Mailer::plainText( $html ) );
	}
}
