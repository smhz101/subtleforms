<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Runs the shell tests of bin/compile-changes.sh (changelog fragments into the
 * readme.txt block) and bin/merge-ledger-updates.sh (ledger update files into
 * bug-ledger.csv) at release time.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class CompileChangesScriptTest extends TestCase {

	public function test_compile_changes_script_passes_its_shell_test(): void {
		$this->run_shell_test( 'test-compile-changes.sh' );
	}

	public function test_merge_ledger_updates_script_passes_its_shell_test(): void {
		$this->run_shell_test( 'test-merge-ledger-updates.sh' );
	}

	private function run_shell_test( string $name ): void {
		if ( ! function_exists( 'proc_open' ) || '' === trim( (string) shell_exec( 'command -v bash' ) ) ) {
			$this->markTestSkipped( 'bash is not available.' );
		}

		$script = dirname( __DIR__, 2 ) . '/bin/' . $name;
		$output = array();
		$status = 0;
		exec( 'bash ' . escapeshellarg( $script ) . ' 2>&1', $output, $status );

		$this->assertSame( 0, $status, implode( "\n", $output ) );
	}
}
