<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Every template, including ones added by Pro, emails the site owner and
 * does not collect a card number.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Templates\FormTemplates;

final class TemplateNotifyTest extends TestCase {

	public function test_every_template_emails_the_owner(): void {
		$templates = FormTemplates::get_all();
		$this->assertNotEmpty( $templates );

		foreach ( $templates as $id => $template ) {
			$schema = $template['schema'] ?? array();
			$this->assertIsArray( $schema, (string) $id );
			$this->assertNoExampleUrl( $schema, (string) $id );
			// Card fields in add-on templates are checked by the add-on (Pro P240-2).
			if ( empty( $template['is_pro'] ) ) {
				$this->assertNoCardFields( is_array( $schema['fields'] ?? null ) ? $schema['fields'] : array(), (string) $id );
				$this->assertNoCardFields( is_array( $schema['steps'] ?? null ) ? $schema['steps'] : array(), (string) $id );
			}

			$emails = array();
			foreach ( (array) ( $schema['actions'] ?? array() ) as $action ) {
				if ( is_array( $action ) && 'email' === ( $action['type'] ?? '' ) && ! empty( $action['enabled'] ) ) {
					$emails[] = $action;
				}
			}
			$this->assertCount( 1, $emails, (string) $id );
			$this->assertSame( '{admin_email}', $emails[0]['config']['to'] ?? null, (string) $id );
			$this->assertSame( 'New entry: {form_title}', $emails[0]['config']['subject'] ?? null, (string) $id );
			$this->assertSame( '', $emails[0]['config']['message'] ?? null, (string) $id );
		}

		$free = FormTemplates::free_templates();
		$this->assertArrayNotHasKey( 'payment_form', $free );
		$this->assertArrayNotHasKey( 'donation_form', $free );
	}

	/**
	 * @param mixed $value Nested value.
	 */
	private function assertNoExampleUrl( $value, string $id ): void {
		if ( is_string( $value ) ) {
			if ( preg_match( '#https?://#i', $value ) ) {
				$host = wp_parse_url( $value, PHP_URL_HOST );
				$host = is_string( $host ) ? strtolower( $host ) : '';
				$this->assertFalse(
					'example.com' === $host || str_ends_with( $host, '.example.com' ),
					$id . ' still points at ' . $value
				);
			}
			return;
		}
		if ( is_array( $value ) ) {
			foreach ( $value as $child ) {
				$this->assertNoExampleUrl( $child, $id );
			}
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
	 */
	private function has_type( array $fields, string $type ): bool {
		return $this->has_field(
			$fields,
			static function ( array $field ) use ( $type ): bool {
				return $type === ( $field['type'] ?? '' );
			}
		);
	}

	/**
	 * @param array<int, mixed> $fields Fields.
	 */
	private function has_field( array $fields, callable $match ): bool {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( $match( $field ) ) {
				return true;
			}
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) && $this->has_field( $field[ $child ], $match ) ) {
					return true;
				}
			}
		}
		return false;
	}
}
