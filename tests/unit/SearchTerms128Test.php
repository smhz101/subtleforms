<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * 2.9.2 (#128): entry search finds non-Latin text, which older rows hold as
 * \uXXXX escapes.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SearchTerms;

final class SearchTerms128Test extends TestCase {

	private $saved;

	protected function setUp(): void {
		$this->saved     = $GLOBALS['wpdb'] ?? null;
		$GLOBALS['wpdb'] = new class() {
			// Same as wpdb::esc_like().
			public function esc_like( $text ) {
				return addcslashes( $text, '_%\\' );
			}
		};
	}

	protected function tearDown(): void {
		$GLOBALS['wpdb'] = $this->saved;
	}

	public function test_ascii_query_gives_one_pattern() {
		$this->assertSame( array( '%Ayesha%' ), SearchTerms::likePatterns( 'Ayesha' ) );
	}

	public function test_arabic_query_adds_the_escaped_form() {
		$this->assertSame(
			array( '%محمد%', '%\\\\u0645\\\\u062d\\\\u0645\\\\u062f%' ),
			SearchTerms::likePatterns( 'محمد' )
		);
	}

	public function test_mixed_query_keeps_ascii_as_is_in_the_escaped_form() {
		$this->assertSame(
			array( '%محمد Khan%', '%\\\\u0645\\\\u062d\\\\u0645\\\\u062f Khan%' ),
			SearchTerms::likePatterns( 'محمد Khan' )
		);
	}

	public function test_chinese_and_cyrillic_queries_get_two_patterns() {
		$this->assertCount( 2, SearchTerms::likePatterns( '田中' ) );
		$this->assertSame( '%\\\\u7530\\\\u4e2d%', SearchTerms::likePatterns( '田中' )[1] );
		$this->assertSame( '%\\\\u041f\\\\u0435\\\\u0442\\\\u0440\\\\u043e\\\\u0432%', SearchTerms::likePatterns( 'Петров' )[1] );
	}

	public function test_percent_and_underscore_stay_escaped_in_both_patterns() {
		$this->assertSame( array( '%50\\%\\_off%' ), SearchTerms::likePatterns( '50%_off' ) );
		$patterns = SearchTerms::likePatterns( '田_中%' );
		$this->assertSame( '%田\\_中\\%%', $patterns[0] );
		$this->assertSame( '%\\\\u7530\\_\\\\u4e2d\\%%', $patterns[1] );
	}
}
