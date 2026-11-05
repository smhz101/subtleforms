<?php
/**
 * A subscriber built from an entry and the form's Mailchimp settings.
 *
 * @package SubtleForms\Integrations\Mailchimp
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\Mailchimp;

use SubtleForms\Support\FieldMapper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Who to add, with what, and how.
 */
final class Subscriber {

	/** @var string */
	public string $email = '';

	/** @var string */
	public string $firstName = '';

	/** @var string */
	public string $lastName = '';

	/** @var array<string,string> Merge field tag => value. */
	public array $fields = array();

	/** @var string[] */
	public array $tags = array();

	/** @var string Audience ID. */
	public string $listId = '';

	/** @var bool New contacts get "pending" and Mailchimp asks them to confirm. */
	public bool $doubleOptIn = false;

	/** @var bool Existing members get their merge fields updated. */
	public bool $updateExisting = true;

	/**
	 * Settings of a form (metadata.integrations.mailchimp), cleaned.
	 *
	 * Keys: enabled, list_id, fields { email, first_name, last_name },
	 * merge_fields [ { field, target } ], tags (comma separated), double_optin,
	 * update_existing, consent_field.
	 *
	 * @param mixed $config Stored settings.
	 * @return array<string,mixed>
	 */
	public static function normalize( $config ): array {
		$config = is_array( $config ) ? $config : array();
		$fields = is_array( $config['fields'] ?? null ) ? $config['fields'] : array();
		$rows   = array();
		foreach ( is_array( $config['merge_fields'] ?? null ) ? $config['merge_fields'] : array() as $row ) {
			if ( is_array( $row ) ) {
				$rows[] = array(
					'field'  => trim( (string) ( $row['field'] ?? '' ) ),
					'target' => strtoupper( trim( (string) ( $row['target'] ?? '' ) ) ),
				);
			}
		}
		return array(
			'enabled'         => ! empty( $config['enabled'] ),
			'list_id'         => trim( (string) ( $config['list_id'] ?? '' ) ),
			'fields'          => array(
				'email'      => trim( (string) ( $fields['email'] ?? '' ) ),
				'first_name' => trim( (string) ( $fields['first_name'] ?? '' ) ),
				'last_name'  => trim( (string) ( $fields['last_name'] ?? '' ) ),
			),
			'merge_fields'    => $rows,
			'tags'            => is_array( $config['tags'] ?? null ) ? implode( ', ', array_map( 'strval', $config['tags'] ) ) : (string) ( $config['tags'] ?? '' ),
			'double_optin'    => ! empty( $config['double_optin'] ),
			'update_existing' => array_key_exists( 'update_existing', $config ) ? ! empty( $config['update_existing'] ) : true,
			'consent_field'   => trim( (string) ( $config['consent_field'] ?? '' ) ),
		);
	}

	/**
	 * Build a subscriber from an entry.
	 *
	 * @param array $config  Settings from normalize().
	 * @param array $schema  Form schema.
	 * @param array $payload Answers.
	 * @return array{subscriber:?self,skip:?string} `skip` is `consent_not_given` or `no_email` when nobody is added.
	 */
	public static function build( array $config, array $schema, array $payload ): array {
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
					'subscriber' => null,
					'skip'       => 'consent_not_given',
				);
			}
		}

		$emailSource = '' !== $fields['email'] ? $fields['email'] : $auto['email'];
		$email       = strtolower( FieldMapper::value( $payload, $emailSource ) );
		if ( '' === $email || ! filter_var( $email, FILTER_VALIDATE_EMAIL ) ) {
			return array(
				'subscriber' => null,
				'skip'       => 'no_email',
			);
		}

		$sub        = new self();
		$sub->email = $email;

		$lastMapped  = '' !== $fields['last_name'];
		$firstSource = '' !== $fields['first_name'] ? $fields['first_name'] : $auto['first_name'];
		$lastSource  = $lastMapped ? $fields['last_name'] : $auto['last_name'];

		$first = '' !== $firstSource ? FieldMapper::value( $payload, $firstSource, $schema ) : '';
		$last  = '' !== $lastSource ? FieldMapper::value( $payload, $lastSource, $schema ) : '';

		// A single "Full name" field mapped to first name: split it.
		if ( '' === $last && '' === $lastSource && false === strpos( $firstSource, '.' ) && false !== strpos( $first, ' ' ) ) {
			list( $first, $last ) = FieldMapper::splitName( $first );
		}

		$sub->firstName      = $first;
		$sub->lastName       = $last;
		$sub->fields         = FieldMapper::mapRows( $payload, $config['merge_fields'], 'target', $schema );
		$sub->tags           = self::parseTags( $config['tags'] );
		$sub->listId         = $config['list_id'];
		$sub->doubleOptIn    = $config['double_optin'];
		$sub->updateExisting = $config['update_existing'];

		return array(
			'subscriber' => $sub,
			'skip'       => null,
		);
	}

	/**
	 * Split a comma separated tag list. A tag is plain text of up to 100
	 * characters; repeats are dropped.
	 *
	 * @param mixed $raw Tags as text or a list.
	 * @return string[]
	 */
	public static function parseTags( $raw ): array {
		$list = is_array( $raw ) ? $raw : explode( ',', (string) $raw );
		$tags = array();
		foreach ( $list as $tag ) {
			$tag = trim( wp_strip_all_tags( (string) $tag ) );
			if ( '' !== $tag && ! in_array( $tag, $tags, true ) ) {
				$tags[] = function_exists( 'mb_substr' ) ? mb_substr( $tag, 0, 100 ) : substr( $tag, 0, 100 );
			}
		}
		return $tags;
	}
}
