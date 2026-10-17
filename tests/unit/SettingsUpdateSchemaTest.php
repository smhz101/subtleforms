<?php
/**
 * Settings update accepts in-range autosave, trash days, and blank emails.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use SubtleForms\Api\SettingsApi;
use SubtleForms\Support\Settings;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;
use SubtleForms\Validation\ValidationException;

/**
 * @covers \SubtleForms\Validation\Schemas
 */
final class SettingsUpdateSchemaTest extends TestCase {

	private RequestValidator $validator;

	protected function setUp(): void {
		$this->validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
	}

	/**
	 * Run a settings payload through SETTINGS_UPDATE.
	 *
	 * @param array $input Settings fields.
	 * @return array Sanitized payload.
	 */
	private function update( array $input ): array {
		return $this->validator->validateOrFail( $input, Schemas::get( Schemas::SETTINGS_UPDATE ) );
	}

	public function test_blank_emails_trash_days_and_soft_delete_succeed(): void {
		$sanitized = $this->update(
			array(
				'autosave_interval'  => 4,
				'entries_trash_days' => 30,
				'sender_email'       => '',
				'admin_email'        => '',
				'delete_behavior'    => 'soft',
			)
		);

		$this->assertSame( 4, $sanitized['autosave_interval'] );
		$this->assertSame( 30, $sanitized['entries_trash_days'] );
		$this->assertSame( 'soft', $sanitized['delete_behavior'] );
	}

	/**
	 * @dataProvider validAutosaveIntervals
	 */
	public function test_autosave_interval_in_range_is_kept( int $interval ): void {
		$sanitized = $this->update( array( 'autosave_interval' => $interval ) );

		$this->assertSame( $interval, $sanitized['autosave_interval'] );
	}

	public function validAutosaveIntervals(): array {
		return array(
			'minimum' => array( 1 ),
			'mid'     => array( 4 ),
			'maximum' => array( 60 ),
		);
	}

	/**
	 * @dataProvider invalidAutosaveIntervals
	 */
	public function test_autosave_interval_out_of_range_is_rejected( int $interval ): void {
		try {
			$this->update( array( 'autosave_interval' => $interval ) );
			$this->fail( 'Expected ValidationException' );
		} catch ( ValidationException $e ) {
			$this->assertArrayHasKey( 'autosave_interval', $e->getFields() );
		}
	}

	public function invalidAutosaveIntervals(): array {
		return array(
			'below minimum' => array( 0 ),
			'above maximum' => array( 61 ),
		);
	}

	public function test_unknown_setting_is_rejected(): void {
		try {
			$this->update( array( 'not_a_setting' => 'nope' ) );
			$this->fail( 'Expected ValidationException' );
		} catch ( ValidationException $e ) {
			$this->assertSame( 'Unknown field', $e->getFields()['not_a_setting'] );
		}
	}

	public function test_optional_emails_have_no_format_and_accept_empty(): void {
		$api    = new SettingsApi( new Settings() );
		$method = new ReflectionMethod( SettingsApi::class, 'getUpdateArgs' );
		$method->setAccessible( true );
		$args = $method->invoke( $api );

		foreach ( array( 'sender_email', 'admin_email' ) as $key ) {
			$this->assertArrayNotHasKey( 'format', $args[ $key ] );
			$this->assertTrue( $args[ $key ]['validate_callback']( '', null, $key ) );
		}
	}
}
