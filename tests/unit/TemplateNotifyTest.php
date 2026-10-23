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
	}

	public function test_a_template_loses_its_example_webhook_and_card_fields(): void {
		$method = new \ReflectionMethod( FormTemplates::class, 'prepare_template' );
		$method->setAccessible( true );

		$payment = $method->invoke(
			null,
			'checkout',
			array(
				'id'     => 'checkout',
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
		$this->assertTemplateIsSafe( 'checkout', $payment );
		$this->assertSame( array( 'full_name' ), array_column( $payment['schema']['fields'], 'id' ) );
	}

	/**
	 * Review #15 (4309460612): raw card inputs are found by their id or key
	 * only. Fields that merely mention a card in a label or an unrelated id,
	 * and the gateway-managed Card Payment field, are kept.
	 */
	public function test_only_raw_card_inputs_are_removed(): void {
		$method = new \ReflectionMethod( FormTemplates::class, 'prepare_template' );
		$method->setAccessible( true );
		$fields = array(
			array( 'id' => 'card_number', 'type' => 'text', 'label' => 'Number' ),
			array( 'id' => 'f2', 'key' => 'cc-number', 'type' => 'text', 'label' => 'Number' ),
			array( 'id' => 'credit_card_number', 'type' => 'text', 'label' => 'Number' ),
			array( 'id' => 'exp_date', 'type' => 'text', 'label' => 'Valid until' ),
			array( 'id' => 'f5', 'type' => 'text', 'label' => 'Code', 'config' => array( 'key' => 'cvc' ) ),
			array( 'id' => 'scorecard', 'type' => 'number', 'label' => 'Scorecard' ),
			array( 'id' => 'discard_reason', 'type' => 'textarea', 'label' => 'Reason' ),
			array( 'id' => 'gift_message', 'type' => 'textarea', 'label' => 'Gift card message' ),
			array( 'id' => 'passport_expiry', 'type' => 'date', 'label' => 'Passport expiry date' ),
			array( 'id' => 'card', 'type' => 'payment_card', 'label' => 'Card details' ),
			array(
				'id'       => 'card_section',
				'type'     => 'group_container',
				'label'    => 'Card holder',
				'children' => array(
					array( 'id' => 'holder_name', 'type' => 'text', 'label' => 'Name on card' ),
					array( 'id' => 'cvv', 'type' => 'text', 'label' => 'CVV' ),
				),
			),
		);
		$out  = $method->invoke( null, 'extension_checkout', array( 'id' => 'extension_checkout', 'schema' => array( 'fields' => $fields ) ) );
		$kept = array();
		$walk = static function ( array $list ) use ( &$walk, &$kept ): void {
			foreach ( $list as $field ) {
				$kept[] = $field['id'];
				$walk( $field['children'] ?? array() );
			}
		};
		$walk( $out['schema']['fields'] );
		$this->assertSame(
			array( 'scorecard', 'discard_reason', 'gift_message', 'passport_expiry', 'card', 'card_section', 'holder_name' ),
			$kept
		);
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
			$this->assertFalse( FormTemplates::is_card_field( $field ), $id . ' field ' . wp_json_encode( $field ) );
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
