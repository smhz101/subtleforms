<?php
/**
 * Upload answers in notification emails stay names, not raw file records.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use SubtleForms\Engine\Actions\EmailAction;

/**
 * @covers \SubtleForms\Engine\Actions\EmailAction
 */
final class EmailUploadFormatTest extends TestCase {

	/**
	 * @param array $payload Answers.
	 */
	private function format( array $payload ): array {
		$method = new ReflectionMethod( EmailAction::class, 'format_uploads' );
		$method->setAccessible( true );
		return $method->invoke( new EmailAction(), $payload, 0 );
	}

	public function test_file_list_is_formatted_instead_of_left_as_records(): void {
		$out = $this->format(
			array(
				'resume' => array(
					array(
						'id'   => str_repeat( 'a', 32 ),
						'name' => 'photo.png',
						'size' => 12,
					),
				),
			)
		);
		$this->assertSame( 'photo.png', $out['resume'] );
	}

	public function test_repeater_group_still_formats_its_upload(): void {
		$out = $this->format(
			array(
				'jobs' => array(
					array(
						'resume' => array(
							array(
								'id'   => str_repeat( 'b', 32 ),
								'name' => 'cv.pdf',
								'size' => 4,
							),
						),
					),
				),
			)
		);
		$this->assertSame( 'cv.pdf', $out['jobs'][0]['resume'] );
	}
}
