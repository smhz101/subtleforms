<?php
/**
 * A CRM contact built from an entry and the form's settings.
 *
 * @package SubtleForms\Integrations\Crm
 * @since   2.8.1
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Crm;

use SubtleForms\Support\FieldMapper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Who to create or update, with what, and how.
 */
final class Contact {

	/** @var string */
	public string $email = '';

	/** @var string */
	public string $firstName = '';

	/** @var string */
	public string $lastName = '';

	/** @var string */
	public string $phone = '';

	/** @var string */
	public string $company = '';

	/** @var array<string,string> CRM property => value (custom properties and anything an add-on sets). */
	public array $properties = array();

	/** @var bool Existing contacts get their properties updated. */
	public bool $updateExisting = true;

	/** @var string Slug of the CRM this contact goes to. */
	public string $service = 'hubspot';

	/**
	 * Settings of a form (metadata.integrations.{service}), cleaned.
	 *
	 * Keys: enabled, fields { email, first_name, last_name, phone, company },
	 * properties [ { field, property } ], update_existing (default on),
	 * consent_field.
	 *
	 * @param mixed $config Stored settings.
	 * @return array<string,mixed>
	 */
	public static function normalize( $config ): array {
		$config = is_array( $config ) ? $config : array();
		$fields = is_array( $config['fields'] ?? null ) ? $config['fields'] : array();
		$rows   = array();
		foreach ( is_array( $config['properties'] ?? null ) ? $config['properties'] : array() as $row ) {
			if ( is_array( $row ) ) {
				$rows[] = array(
					'field'    => trim( (string) ( $row['field'] ?? '' ) ),
					'property' => strtolower( trim( (string) ( $row['property'] ?? '' ) ) ),
				);
			}
		}
		$clean = array();
		foreach ( array( 'email', 'first_name', 'last_name', 'phone', 'company' ) as $name ) {
			$clean[ $name ] = trim( (string) ( $fields[ $name ] ?? '' ) );
		}
		return array(
			'enabled'         => ! empty( $config['enabled'] ),
			'fields'          => $clean,
			'properties'      => $rows,
			'update_existing' => array_key_exists( 'update_existing', $config ) ? ! empty( $config['update_existing'] ) : true,
			'consent_field'   => trim( (string) ( $config['consent_field'] ?? '' ) ),
		);
	}

	/**
	 * Build a contact from an entry.
	 *
	 * @param array  $config  Settings from normalize().
	 * @param array  $schema  Form schema.
	 * @param array  $payload Answers.
	 * @param string $service Service slug.
	 * @return array{contact:?self,skip:?string} `skip` is `consent_not_given` or `no_email` when nobody is sent.
	 */
	public static function build( array $config, array $schema, array $payload, string $service = 'hubspot' ): array {
		$config = self::normalize( $config );
		$auto   = FieldMapper::defaults( $schema );
		$fields = $config['fields'];

		$consentKey = $config['consent_field'];
		if ( '' !== $consentKey ) {
			$definition = null;
			foreach ( FieldMapper::fields( $schema ) as $field ) {
				if ( $field['key'] === $consentKey ) {
					$definition = $field['field'];
					break;
				}
			}
			if ( ! FieldMapper::isChecked( FieldMapper::raw( $payload, $consentKey ), $definition ) ) {
				return array(
					'contact' => null,
					'skip'    => 'consent_not_given',
				);
			}
		}

		$emailSource = '' !== $fields['email'] ? $fields['email'] : $auto['email'];
		$email       = strtolower( FieldMapper::value( $payload, $emailSource ) );
		if ( '' === $email || ! filter_var( $email, FILTER_VALIDATE_EMAIL ) ) {
			return array(
				'contact' => null,
				'skip'    => 'no_email',
			);
		}

		$firstSource = '' !== $fields['first_name'] ? $fields['first_name'] : $auto['first_name'];
		$lastSource  = '' !== $fields['last_name'] ? $fields['last_name'] : $auto['last_name'];
		$first       = '' !== $firstSource ? FieldMapper::value( $payload, $firstSource, $schema ) : '';
		$last        = '' !== $lastSource ? FieldMapper::value( $payload, $lastSource, $schema ) : '';
		// A single "Full name" field mapped to first name: split it.
		if ( '' === $last && '' === $lastSource && false === strpos( $firstSource, '.' ) && false !== strpos( $first, ' ' ) ) {
			list( $first, $last ) = FieldMapper::splitName( $first );
		}

		$phoneSource = $fields['phone'];
		if ( '' === $phoneSource ) {
			$phone       = FieldMapper::firstOfType( $schema, 'phone' );
			$phoneSource = is_array( $phone ) ? (string) ( $phone['key'] ?? '' ) : '';
		}
		$companySource = $fields['company'];
		if ( '' === $companySource ) {
			foreach ( FieldMapper::fields( $schema ) as $field ) {
				if ( preg_match( '/^(company|company_name|organi[sz]ation|business)$/', strtolower( (string) $field['key'] ) ) ) {
					$companySource = (string) $field['key'];
					break;
				}
			}
		}

		$contact                 = new self();
		$contact->service        = $service;
		$contact->email          = $email;
		$contact->firstName      = $first;
		$contact->lastName       = $last;
		$contact->phone          = '' !== $phoneSource ? FieldMapper::value( $payload, $phoneSource, $schema ) : '';
		$contact->company        = '' !== $companySource ? FieldMapper::value( $payload, $companySource, $schema ) : '';
		$contact->properties     = FieldMapper::mapRows( $payload, $config['properties'], 'property', $schema );
		$contact->updateExisting = $config['update_existing'];

		return array(
			'contact' => $contact,
			'skip'    => null,
		);
	}
}
