<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * A "<" in an answer is text, not the start of a tag (issue #80), and the
 * request values stored beside an entry are cut to their column length
 * (issue #81).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Validation\Sanitizer;

final class SanitizerLessThanTest extends TestCase {

	/**
	 * @dataProvider plainAnswers
	 */
	public function test_a_less_than_sign_that_opens_no_tag_is_kept( string $answer ): void {
		$this->assertSame( $answer, Sanitizer::sanitizeSubmissionValue( $answer ) );
	}

	public static function plainAnswers(): array {
		return array(
			'number'         => array( 'a <5 b' ),
			'heart'          => array( 'I <3 it' ),
			'comparison'     => array( 'x<y' ),
			'at the start'   => array( '<2 weeks' ),
			'money'          => array( 'price <$50' ),
			'long sentence'  => array( 'Budget <5000 USD, please call me after 6pm' ),
			'two of them'    => array( 'a <5 and b <6 then c' ),
			'entity as typed' => array( 'Tom &lt; Jerry' ),
		);
	}

	public function test_line_breaks_survive(): void {
		$this->assertSame( "line <1\nline <2", Sanitizer::sanitizeSubmissionValue( "line <1\nline <2" ) );
	}

	public function test_real_tags_are_still_stripped(): void {
		$this->assertSame( 'hello', Sanitizer::sanitizeSubmissionValue( '<b>hello</b>' ) );
		$this->assertSame( 'hi', Sanitizer::sanitizeSubmissionValue( 'hi<script>alert(1)</script>' ) );
		$this->assertSame( 'x', Sanitizer::sanitizeSubmissionValue( '<img src=x onerror=alert(1)>x' ) );
	}

	public function test_a_stray_less_than_next_to_a_real_tag(): void {
		$this->assertSame( 'a <5 b', Sanitizer::sanitizeSubmissionValue( 'a <5 b <i>' ) );
		$this->assertSame( 'a <5 bold', Sanitizer::sanitizeSubmissionValue( 'a <5 <b>bold</b>' ) );
	}

	/**
	 * Stripping a tag nested inside another, or putting a sign back, must not
	 * join the pieces into a tag that was not in the input.
	 *
	 * @dataProvider joinedTags
	 */
	public function test_pieces_never_join_into_a_tag( string $input ): void {
		$out = Sanitizer::sanitizeSubmissionValue( $input );
		$this->assertDoesNotMatchRegularExpression( '/<[A-Za-z\/!?][^>]*>/', $out, 'no tag in the answer' );
		$this->assertStringNotContainsString( 'onerror', strtolower( str_replace( 'alert(1)', '', $out ) ) );
		$this->assertSame( $out, Sanitizer::sanitizeSubmissionValue( $out ), 'a second pass changes nothing' );
	}

	public static function joinedTags(): array {
		return array(
			'tag inside an attribute list' => array( '<img src=x onerror=alert(1)<b>>' ),
			'tag inside a tag name'        => array( '<img<i> src=x onerror=alert(1)>' ),
			'script split by a tag'        => array( '<scr<b>ipt>alert(1)</script>' ),
			'doubled opener'               => array( '<<script>script>alert(1)<</script>/script>' ),
			'nested twice'                 => array( '<b<i<u>>>' ),
		);
	}

	public function test_the_joined_inputs_come_out_as_plain_text_or_nothing(): void {
		$this->assertSame( '', Sanitizer::sanitizeSubmissionValue( '<img src=x onerror=alert(1)<b>>' ) );
		$this->assertSame( '', Sanitizer::sanitizeSubmissionValue( '<img<i> src=x onerror=alert(1)>' ) );
		$this->assertSame( 'alert(1)', Sanitizer::sanitizeSubmissionValue( '<scr<b>ipt>alert(1)</script>' ) );
	}

	public function test_a_visitor_cannot_smuggle_the_stand_in_character(): void {
		$answer = "x\x1A\x1ASF_LT\x1A\x1Ay";
		$this->assertSame( 'xy', Sanitizer::sanitizeSubmissionValue( $answer ) );
	}

	public function test_nested_answers_are_kept(): void {
		$this->assertSame(
			array( 'a' => array( 'b' => 'I <3 it' ) ),
			Sanitizer::sanitizeArrayDeep( array( 'a' => array( 'b' => 'I <3 it' ) ) )
		);
	}

	public function test_fit_cuts_to_the_column_length_in_characters(): void {
		$this->assertSame( 255, mb_strlen( SubmissionsRepository::fit( str_repeat( 'a', 300 ), SubmissionsRepository::USER_AGENT_LENGTH ) ) );
		$this->assertSame( 'abc', SubmissionsRepository::fit( 'abc', 255 ) );
		$this->assertSame( 255, mb_strlen( SubmissionsRepository::fit( str_repeat( "\u{00e9}", 300 ), 255 ) ) );
		$this->assertNull( SubmissionsRepository::fit( null, 255 ) );
		$this->assertSame( 45, mb_strlen( SubmissionsRepository::fit( str_repeat( '1', 60 ), SubmissionsRepository::IP_LENGTH ) ) );
	}
}
