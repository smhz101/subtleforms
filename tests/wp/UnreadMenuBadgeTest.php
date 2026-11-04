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

	public function test_counts_above_99_show_as_99_plus(): void {
		$this->assertStringContainsString( '>99<', AdminMenu::unread_badge( 99 ) );
		$badge = AdminMenu::unread_badge( 1250 );
		$this->assertStringContainsString( '>99+<', $badge );
		$this->assertStringContainsString( 'count-100', $badge );
		$this->assertStringContainsString( '1,250 unread entries', $badge );
	}
}
