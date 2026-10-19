<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Template notifications: no example.com webhooks, an email to the site
 * owner, and no card number fields.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Templates\FormTemplates;

class TemplateNotifyTest extends TestCase {

	public function test_every_template_emails_the_owner_and_skips_card_fields(): void {
		$templates = FormTemplates::get_all();
		$this->assertNotEmpty( $templates );
		foreach ( $templates as $id => $template ) {
			$this->assertTemplateIsSafe( (string) $id, $template );
		}

		$payment = $templates['payment_form'];
		$types   = $this->field_types( $payment['schema']['fields'] );
		$this->assertContains( 'payment_product', $types );
		$this->assertContains( 'payment_summary', $types );
		$this->assertStringContainsString( 'SubtleForms Pro', wp_json_encode( $payment['schema']['fields'] ) );

		$donation = $templates['donation_form'];
		$this->assertTrue(
			$this->field_tree_has(
				$donation['schema']['fields'],
				static function ( array $field ): bool {
					return 'payment_amount' === ( $field['type'] ?? '' ) && 'Custom Amount' === ( $field['label'] ?? '' );
				}
			)
		);
	}

	public function test_a_pro_style_template_loses_its_example_webhook_and_card_fields(): void {
		$method = new \ReflectionMethod( FormTemplates::class, 'prepare_template' );
		$method->setAccessible( true );

		$payment = $method->invoke(
			null,
			'payment_form',
			array(
				'id'     => 'payment_form',
				'schema' => array(
					'fields'  => array(
						array(
							'id'    => 'full_name',
							'type'  => 'text',
							'label' => 'Full Name',
						),
						array(
							'id'    => 'card_number',
							'type'  => 'text',
							'label' => 'Card Number',
						),
						array(
							'id'    => 'expiry',
							'type'  => 'text',
							'label' => 'Expiry Date',
						),
						array(
							'id'    => 'cvv',
							'type'  => 'text',
							'label' => 'CVV',
						),
					),
					'actions' => array(
						array(
							'id'      => 'webhook',
							'type'    => 'webhook',
							'enabled' => true,
							'config'  => array( 'url' => 'https://payment-gateway.example.com/api/charge' ),
						),
					),
				),
			)
		);
		$this->assertTemplateIsSafe( 'payment_form', $payment );
		$this->assertContains( 'payment_product', $this->field_types( $payment['schema']['fields'] ) );
		$this->assertContains( 'payment_summary', $this->field_types( $payment['schema']['fields'] ) );

		$donation = $method->invoke(
			null,
			'donation_form',
			array(
				'id'     => 'donation_form',
				'schema' => array(
					'fields'  => array(
						array(
							'id'    => 'custom_amount',
							'type'  => 'number',
							'label' => 'Custom Amount ($)',
						),
					),
					'actions' => array(
						array(
							'type'   => 'webhook',
							'config' => array( 'url' => 'https://donations.example.com/api/give' ),
						),
					),
				),
			)
		);
		$this->assertTemplateIsSafe( 'donation_form', $donation );
		$this->assertSame( 'payment_amount', $donation['schema']['fields'][0]['type'] );
		$this->assertSame( 'Custom Amount', $donation['schema']['fields'][0]['label'] );
	}

	/**
	 * Review #15 (4309435330): the Payment Form product is fixed. It has no
	 * quantity box on the live form, so the builder must not show one either,
	 * and the server prices it once with no submitted value.
	 */
	public function test_payment_template_product_is_a_fixed_product(): void {
		$templates = FormTemplates::get_all();
		$product   = null;
		foreach ( $templates['payment_form']['schema']['fields'] as $field ) {
			if ( 'payment_product' === ( $field['type'] ?? '' ) ) {
				$product = $field;
			}
		}
		$this->assertIsArray( $product );
		$this->assertArrayHasKey( 'allowQuantity', $product );
		$this->assertFalse( $product['allowQuantity'] );

		$product['key'] = 'product';
		$quote          = \SubtleForms\Payments\Pricing::quote( array( 'fields' => array( $product ) ), array() );
		$this->assertSame( 10.0, (float) $quote['total'] );
		$this->assertSame( 1, (int) $quote['items'][0]['qty'] );
	}

	/**
	 * Review #15 (4309435338): the donation amount is required with a
	 * positive minimum, in the built-in template and in one an add-on
	 * supplies with a zero minimum in its config.
	 */
	public function test_donation_amount_is_required_and_positive(): void {
		$templates = FormTemplates::get_all();
		$amount    = $templates['donation_form']['schema']['fields'][0];
		$this->assertSame( 'payment_amount', $amount['type'] );
		$this->assertTrue( $amount['required'] );
		$this->assertGreaterThan( 0, $amount['min'] );

		$method = new \ReflectionMethod( FormTemplates::class, 'prepare_template' );
		$method->setAccessible( true );
		$donation = $method->invoke(
			null,
			'donation_form',
			array(
				'id'     => 'donation_form',
				'schema' => array(
					'fields' => array(
						array(
							'id'     => 'custom_amount',
							'type'   => 'number',
							'label'  => 'Amount',
							'config' => array( 'min' => 0, 'required' => false ),
						),
					),
				),
			)
		);
		$field = $donation['schema']['fields'][0];
		$this->assertTrue( $field['required'] );
		$this->assertTrue( $field['config']['required'] );
		$this->assertGreaterThan( 0, $field['config']['min'] );
		$this->assertGreaterThan( 0, $field['min'] );
	}

	/**
	 * @param array<string, mixed> $template Template definition.
	 */
	private function assertTemplateIsSafe( string $id, array $template ): void {
		$schema = $template['schema'] ?? array();
		$this->assertIsArray( $schema, $id );
		$this->assertNoExampleUrl( $schema, $id );
		$this->assertNoCardFields( is_array( $schema['fields'] ?? null ) ? $schema['fields'] : array(), $id );
		$this->assertNoCardFields( is_array( $schema['steps'] ?? null ) ? $schema['steps'] : array(), $id );

		$emails = array();
		foreach ( (array) ( $schema['actions'] ?? array() ) as $action ) {
			if ( is_array( $action ) && 'email' === ( $action['type'] ?? '' ) && ! empty( $action['enabled'] ) ) {
				$emails[] = $action;
			}
		}
		$this->assertCount( 1, $emails, $id );
		$this->assertSame( '{admin_email}', $emails[0]['config']['to'] ?? null, $id );
		$this->assertSame( 'New entry: {form_title}', $emails[0]['config']['subject'] ?? null, $id );
		$this->assertSame( '', $emails[0]['config']['message'] ?? null, $id );
	}

	/**
	 * @param mixed $value Nested schema value.
	 */
	private function assertNoExampleUrl( $value, string $id ): void {
		if ( is_string( $value ) ) {
			if ( preg_match( '#https?://#i', $value ) ) {
				$host = parse_url( $value, PHP_URL_HOST );
				$host = is_string( $host ) ? strtolower( $host ) : '';
				$this->assertFalse(
					'example.com' === $host || str_ends_with( $host, '.example.com' ),
					$id . ' still points at ' . $value
				);
			}
			return;
		}
		if ( ! is_array( $value ) ) {
			return;
		}
		foreach ( $value as $child ) {
			$this->assertNoExampleUrl( $child, $id );
		}
	}

	/**
	 * @param array<int, mixed> $fields Fields.
	 */
	private function assertNoCardFields( array $fields, string $id ): void {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$haystack = strtolower( (string) ( $field['id'] ?? '' ) . ' ' . (string) ( $field['key'] ?? '' ) . ' ' . (string) ( $field['label'] ?? '' ) );
			$this->assertSame( 0, preg_match( '/card|cvv|expiry/', $haystack ), $id . ' field ' . $haystack );
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) ) {
					$this->assertNoCardFields( $field[ $child ], $id );
				}
			}
		}
	}

	/**
	 * @param array<int, mixed> $fields Fields.
	 * @return string[]
	 */
	private function field_types( array $fields ): array {
		$types = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( isset( $field['type'] ) ) {
				$types[] = (string) $field['type'];
			}
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) ) {
					$types = array_merge( $types, $this->field_types( $field[ $child ] ) );
				}
			}
		}
		return $types;
	}

	/**
	 * @param array<int, mixed> $fields Fields.
	 */
	private function field_tree_has( array $fields, callable $match ): bool {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( $match( $field ) ) {
				return true;
			}
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) && $this->field_tree_has( $field[ $child ], $match ) ) {
					return true;
				}
			}
		}
		return false;
	}
}
