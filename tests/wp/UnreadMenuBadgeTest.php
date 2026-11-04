<?php
/**
 * The unread count bubble on the SubtleForms menu and its Submissions item.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;

final class UnreadMenuBadgeTest extends TestCase {

	public function test_no_bubble_when_nothing_is_unread(): void {
		$this->assertSame( '', AdminMenu::unread_badge( 0 ) );
		$this->assertSame( '', AdminMenu::unread_badge( -3 ) );
	}

	public function test_bubble_uses_the_core_comment_count_markup(): void {
		$badge = AdminMenu::unread_badge( 7 );
		$this->assertStringContainsString( 'class="awaiting-mod count-7"', $badge );
		$this->assertStringContainsString( '<span class="pending-count" aria-hidden="true">7</span>', $badge );
		$this->assertStringContainsString( '<span class="screen-reader-text">7 unread entries</span>', $badge );
		$this->assertStringContainsString( '1 unread entry', AdminMenu::unread_badge( 1 ) );
	}

	public function test_counts_above_9_show_as_9_plus(): void {
		$this->assertStringContainsString( '>9<', AdminMenu::unread_badge( 9 ) );
		$this->assertStringContainsString( 'count-9', AdminMenu::unread_badge( 9 ) );
		$badge = AdminMenu::unread_badge( 1250 );
		$this->assertStringContainsString( '>9+<', $badge );
		$this->assertStringContainsString( 'count-10', $badge );
		$this->assertStringContainsString( '1,250 unread entries', $badge );
		$this->assertStringContainsString( '>9+<', AdminMenu::unread_badge( 10 ) );
	}
}
