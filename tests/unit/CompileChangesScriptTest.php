<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Runs the shell test of bin/compile-changes.sh, the script that turns the
 * changelog fragments in docs/dev/changes/unreleased into the readme.txt
 * block at release time.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class CompileChangesScriptTest extends TestCase {

	public function test_compile_changes_script_passes_its_shell_test(): void {
		if ( ! function_exists( 'proc_open' ) || '' === trim( (string) shell_exec( 'command -v bash' ) ) ) {
			$this->markTestSkipped( 'bash is not available.' );
		}

		$script = dirname( __DIR__, 2 ) . '/bin/test-compile-changes.sh';
		$output = array();
		$status = 0;
		exec( 'bash ' . escapeshellarg( $script ) . ' 2>&1', $output, $status );

		$this->assertSame( 0, $status, implode( "\n", $output ) );
	}
}
