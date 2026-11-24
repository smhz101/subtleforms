<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * An explicit include of "all" shows every stored entry but previews (#131).
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Repositories\SubmissionsRepository;

final class SpamVisibility131Test extends TestCase {

	public function test_include_all_keeps_spam_flagged_and_trash(): void {
		$this->assertSame( array( SubmissionsRepository::NOT_PREVIEW ), SubmissionsRepository::visibilityConditions( null, 'all' ) );
		$this->assertStringNotContainsString( 'spam', SubmissionsRepository::NOT_PREVIEW );
		$this->assertStringNotContainsString( 'trash', SubmissionsRepository::NOT_PREVIEW );
	}

	public function test_default_still_hides_spam(): void {
		$this->assertSame( array( SubmissionsRepository::INBOX ), SubmissionsRepository::visibilityConditions( null ) );
	}
}
