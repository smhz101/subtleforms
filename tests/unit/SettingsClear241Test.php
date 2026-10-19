<?php
/**
 * 2.4.1: a settings update can clear a saved text or list value.
 *
 * @package SubtleForms\Tests
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;

final class SettingsClear241Test extends TestCase {

	private function validate( array $input ): array {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		return $validator->validateOrFail( $input, Schemas::get( Schemas::SETTINGS_UPDATE ) );
	}

	public function test_an_empty_text_setting_that_was_sent_is_kept(): void {
		$out = $this->validate( array( 'ext_crm_api_key' => '', 'sender_name' => 'Shop' ) );
		$this->assertArrayHasKey( 'ext_crm_api_key', $out );
		$this->assertSame( '', $out['ext_crm_api_key'] );
		$this->assertSame( 'Shop', $out['sender_name'] );
	}

	public function test_an_empty_list_setting_that_was_sent_is_kept(): void {
		$out = $this->validate( array( 'ext_webhooks_events' => array() ) );
		$this->assertSame( array(), $out['ext_webhooks_events'] );
	}

	public function test_settings_that_were_not_sent_stay_out(): void {
		$out = $this->validate( array( 'sender_name' => 'Shop' ) );
		$this->assertArrayNotHasKey( 'ext_crm_api_key', $out );
	}

	public function test_empty_numbers_switches_and_choices_are_still_ignored(): void {
		$out = $this->validate( array( 'autosave_interval' => '', 'debug_mode' => '', 'delete_behavior' => '', 'sender_name' => 'Shop' ) );
		$this->assertArrayNotHasKey( 'autosave_interval', $out );
		$this->assertArrayNotHasKey( 'debug_mode', $out );
		$this->assertArrayNotHasKey( 'delete_behavior', $out );
	}

	public function test_other_schemas_still_leave_optional_empty_fields_out(): void {
		$validator = new RequestValidator();
		$out       = $validator->validateOrFail( array( 'title' => 'A', 'note' => '' ), array( 'title' => 'required|string', 'note' => 'optional|string' ) );
		$this->assertArrayNotHasKey( 'note', $out );
	}
}
