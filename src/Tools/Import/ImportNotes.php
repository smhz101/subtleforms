<?php
/**
 * The report of one imported form: what was skipped and what changed.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Report lines collected while a form is mapped.
 *
 * `skipped` means something was not copied. `changed` means it was copied in
 * a different shape. `info` is a plain fact, such as how many emails came
 * across.
 */
final class ImportNotes {

	public const SKIPPED = 'skipped';
	public const CHANGED = 'changed';
	public const INFO    = 'info';

	/** @var array<int, array{level: string, text: string}> */
	private $lines = array();

	/**
	 * Something was not copied.
	 *
	 * @param string $text Report line.
	 */
	public function skipped( string $text ): void {
		$this->add( self::SKIPPED, $text );
	}

	/**
	 * Something was copied in a different shape.
	 *
	 * @param string $text Report line.
	 */
	public function changed( string $text ): void {
		$this->add( self::CHANGED, $text );
	}

	/**
	 * A plain fact.
	 *
	 * @param string $text Report line.
	 */
	public function info( string $text ): void {
		$this->add( self::INFO, $text );
	}

	/**
	 * @return array<int, array{level: string, text: string}>
	 */
	public function all(): array {
		return $this->lines;
	}

	/**
	 * Lines that need the owner's attention (skipped or changed).
	 *
	 * @return int
	 */
	public function count(): int {
		$n = 0;
		foreach ( $this->lines as $line ) {
			if ( self::INFO !== $line['level'] ) {
				++$n;
			}
		}
		return $n;
	}

	/**
	 * Plain strings, for the file-based Migrate preview.
	 *
	 * @return string[]
	 */
	public function strings(): array {
		return array_column( $this->lines, 'text' );
	}

	/**
	 * @param string $level Level.
	 * @param string $text  Line.
	 */
	private function add( string $level, string $text ): void {
		$text = trim( $text );
		if ( '' === $text ) {
			return;
		}
		// The same line twice (two merge tags for one missing field) is noise.
		foreach ( $this->lines as $line ) {
			if ( $line['text'] === $text ) {
				return;
			}
		}
		$this->lines[] = array(
			'level' => $level,
			'text'  => $text,
		);
	}
}
