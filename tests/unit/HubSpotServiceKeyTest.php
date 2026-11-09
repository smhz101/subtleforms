<?php
/**
 * HubSpot service keys: the key format check accepts service keys and legacy
 * private app tokens alike, a 401 reads as a rotated or expired key, and the
 * record link is built only from numeric IDs.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Integrations\Crm\HubSpotClient;

final class HubSpotServiceKeyTest extends TestCase {

	public function test_service_keys_and_legacy_tokens_look_like_keys(): void {
		$this->assertTrue( HubSpotClient::looksLikeToken( 'pat-na1-' . str_repeat( 'ab12', 9 ) ) );
		$this->assertTrue( HubSpotClient::looksLikeToken( 'pat-eu1-' . str_repeat( 'cd34', 9 ) ) );
		$this->assertTrue( HubSpotClient::looksLikeToken( '  pat-na1-' . str_repeat( 'ab12', 9 ) . '  ' ) );
		$this->assertFalse( HubSpotClient::looksLikeToken( 'hello world' ) );
		$this->assertFalse( HubSpotClient::looksLikeToken( '' ) );
	}

	public function test_the_messages_say_service_key(): void {
		$this->assertStringContainsString( 'service key', HubSpotClient::badTokenMessage() );
		$this->assertSame( 'HubSpot rejected the key. If you rotated it, paste the new key.', HubSpotClient::errorMessage( 401, array( 'message' => 'x' ) ) );
		$this->assertSame( HubSpotClient::rejectedMessage(), HubSpotClient::errorMessage( 401, array() ) );
		$this->assertStringContainsString( 'service key may be missing a scope: Nope', HubSpotClient::errorMessage( 403, array( 'message' => 'Nope' ) ) );
	}

	public function test_the_record_link_needs_two_numeric_ids(): void {
		$this->assertSame( 'https://app.hubspot.com/contacts/4455667/record/0-1/9001', HubSpotClient::contactUrl( '4455667', '9001' ) );
		$this->assertSame( '', HubSpotClient::contactUrl( '', '9001' ) );
		$this->assertSame( '', HubSpotClient::contactUrl( '4455667', '' ) );
		$this->assertSame( '', HubSpotClient::contactUrl( '44/../55', '9001' ) );
		$this->assertSame( '', HubSpotClient::contactUrl( '4455667', '9001?x=1' ) );
	}
}
