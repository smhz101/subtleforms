<?php
/**
 * Shared rules for webhook actions and the Settings test request (2.4.1).
 *
 * A webhook delivery and a test request use the same address check and the
 * same body, so a test that succeeds means real entries are delivered too.
 *
 * @package SubtleForms
 * @since   2.4.1
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Webhook address, answers and body.
 */
final class Webhooks {

	/**
	 * Values a visitor's browser sends that are not answers: spam traps,
	 * CAPTCHA tokens and the payment reference.
	 */
	const NOT_ANSWERS = array( 'website_url', 'form_rendered_at', 'g-recaptcha-response', 'h-captcha-response', 'cf-turnstile-response', '_payment' );

	/**
	 * Trim an address and add https:// when no scheme was typed, so
	 * "hooks.example.com/abc" works like "https://hooks.example.com/abc".
	 *
	 * @param string $url Address as typed.
	 * @return string
	 */
	public static function normalizeUrl( string $url ): string {
		$url = trim( $url );
		if ( '' === $url || preg_match( '#^[a-z][a-z0-9+.-]*://#i', $url ) ) {
			return $url;
		}
		return 'https://' . ltrim( $url, '/' );
	}

	/**
	 * Why an address cannot be used, or null when it can.
	 *
	 * The address must be a full http or https URL, and it must pass
	 * WordPress's own safety check for outgoing requests
	 * (wp_http_validate_url): local and private addresses and ports other
	 * than 80, 443 and 8080 are refused unless the site allows them with the
	 * http_request_host_is_external or http_allowed_safe_ports filters.
	 *
	 * @param string $url Address (already normalized).
	 * @return \WP_Error|null
	 */
	public static function urlProblem( string $url ): ?\WP_Error {
		$parts = wp_parse_url( $url );
		if ( '' === $url || ! is_array( $parts ) || empty( $parts['host'] ) || ! in_array( strtolower( (string) ( $parts['scheme'] ?? '' ) ), array( 'http', 'https' ), true ) ) {
			return new \WP_Error(
				'invalid_url',
				__( 'Enter the full webhook address, for example https://hooks.example.com/abc.', 'subtleforms' )
			);
		}
		if ( ! wp_http_validate_url( $url ) ) {
			return new \WP_Error(
				'blocked_url',
				sprintf(
					/* translators: %s: host name of the webhook address */
					__( 'WordPress blocks requests to %s. Local and private addresses, and ports other than 80, 443 and 8080, are refused for safety. Use a public address, or ask your developer to allow it with the http_request_host_is_external and http_allowed_safe_ports filters.', 'subtleforms' ),
					(string) $parts['host'] . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' )
				)
			);
		}
		return null;
	}

	/**
	 * The answers a webhook sends: the copy that is stored for the entry,
	 * without spam traps, CAPTCHA tokens or other internal values.
	 *
	 * @param array $payload Submitted answers.
	 * @param mixed $schema  Form schema.
	 * @return array
	 */
	public static function answers( array $payload, $schema ): array {
		$payload = \SubtleForms\Api\PublicSubmitApi::storablePayload( $payload, $schema );
		foreach ( array_keys( $payload ) as $key ) {
			$key = (string) $key;
			if ( '' === $key || in_array( $key, self::NOT_ANSWERS, true ) ) {
				unset( $payload[ $key ] );
			}
		}
		return $payload;
	}

	/**
	 * The default JSON body: the form and entry, every answer keyed by
	 * field, and every answer with its label. SubtleForms Pro sends the same
	 * shape.
	 *
	 * @param array $schema  Form schema.
	 * @param array $answers Answers from answers().
	 * @param array $entry   form_id, form_title, submission_id, submitted_at.
	 * @return array
	 */
	public static function fullBody( array $schema, array $answers, array $entry ): array {
		$labelled = array();
		foreach ( FieldMapper::answers( $schema, $answers, false ) as $row ) {
			$labelled[] = array(
				'key'   => (string) $row['key'],
				'label' => (string) $row['label'],
				'value' => $row['value'],
			);
		}
		$submissionId = (int) ( $entry['submission_id'] ?? 0 );

		return array(
			'event'         => 'submission.created',
			'form_id'       => (int) ( $entry['form_id'] ?? 0 ),
			'form_title'    => (string) ( $entry['form_title'] ?? '' ),
			'submission_id' => $submissionId,
			'created_at'    => (string) ( $entry['submitted_at'] ?? gmdate( 'c' ) ),
			'site_url'      => home_url( '/' ),
			'entry_url'     => $submissionId > 0 ? admin_url( 'admin.php?page=subtleforms-submissions&submission_id=' . $submissionId ) : '',
			// Dependent dropdowns send the label chosen at each level, as emails do.
			'fields'        => (object) ( $schema ? AnswerFormatter::withChainedLabels( $schema, $answers ) : $answers ),
			'answers'       => $labelled,
		);
	}

	/**
	 * Sign a body with HMAC-SHA256 for the X-SubtleForms-Signature header.
	 *
	 * @param string $body   Request body.
	 * @param string $secret Signing secret.
	 * @return string
	 */
	public static function signature( string $body, string $secret ): string {
		return 'sha256=' . hash_hmac( 'sha256', $body, $secret );
	}

	/**
	 * Headers from an action's settings, without line breaks that could add
	 * headers of their own.
	 *
	 * @param mixed $headers Name to value.
	 * @return array<string,string>
	 */
	public static function safeHeaders( $headers ): array {
		$safe = array();
		foreach ( is_array( $headers ) ? $headers : array() as $name => $value ) {
			$name  = trim( (string) $name );
			$value = (string) $value;
			if ( '' === $name || strpbrk( $name, "\r\n:" ) !== false || strpbrk( $value, "\r\n" ) !== false ) {
				continue;
			}
			$safe[ $name ] = $value;
		}
		return $safe;
	}
}
