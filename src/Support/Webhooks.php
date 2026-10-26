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
	 * Values a visitor's browser sends that are not answers: spam traps and
	 * CAPTCHA tokens. Add-ons add theirs through RequestKeys.
	 */
	const NOT_ANSWERS = RequestKeys::BUILT_IN;

	/**
	 * Field types a webhook never sends, even when asked: they hold a secret
	 * or an image of a signature.
	 */
	const SENSITIVE_TYPES = array( 'password', 'signature' );

	/**
	 * Keys of the "selected" payload mode (2.5.0), by group. An answer is
	 * selected as "field:<key>".
	 */
	const FORM_KEYS       = array( 'form_id', 'form_title' );
	const SUBMISSION_KEYS = array( 'submission_id', 'created_at', 'status', 'page_url', 'ip_address', 'user_agent', 'user_id' );
	const FIELD_PREFIX    = 'field:';
	const LABELS_OPTION   = 'answers_with_labels';

	/**
	 * Headers a webhook cannot set: they would break the request or forge
	 * the signature that SubtleForms adds itself.
	 */
	const BLOCKED_HEADERS = array( 'host', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'upgrade', 'te', 'trailer', 'proxy-authorization', 'proxy-connection', 'x-subtleforms-signature' );

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
			if ( '' === $key || RequestKeys::has( $key ) ) {
				unset( $payload[ $key ] );
			}
		}
		return $payload;
	}

	/**
	 * The default JSON body: the form and entry, every answer keyed by
	 * field, and every answer with its label.
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
	 * Why a header cannot be sent, or an empty string when it can. The
	 * builder shows the same reasons.
	 *
	 * @param string $name  Header name.
	 * @param string $value Header value.
	 * @return string Reason code: empty, invalid_name, blocked or invalid_value.
	 */
	public static function headerProblem( string $name, string $value ): string {
		$name = trim( $name );
		if ( '' === $name || ! preg_match( '/^[A-Za-z0-9!#$%&\'*+.^_`|~-]+$/', $name ) ) {
			return 'invalid_name';
		}
		if ( in_array( strtolower( $name ), self::BLOCKED_HEADERS, true ) ) {
			return 'blocked';
		}
		if ( strpbrk( $value, "\r\n" ) !== false ) {
			return 'invalid_value';
		}
		return '';
	}

	/**
	 * Headers from an action's settings, without names or values that could
	 * break the request or add headers of their own.
	 *
	 * @param mixed $headers Name to value.
	 * @return array<string,string>
	 */
	public static function safeHeaders( $headers ): array {
		$safe = array();
		foreach ( is_array( $headers ) ? $headers : array() as $name => $value ) {
			$name  = trim( (string) $name );
			$value = is_scalar( $value ) ? (string) $value : '';
			if ( '' !== self::headerProblem( $name, $value ) ) {
				continue;
			}
			$safe[ $name ] = $value;
		}
		return $safe;
	}

	/**
	 * Every value the "selected" payload can send about the entry, with
	 * its real value (2.5.0).
	 *
	 * @param \SubtleForms\Engine\SubmissionContext $context Submission context.
	 * @param array                                   $schema  Form schema.
	 * @return array<string,mixed>
	 */
	public static function entryValues( $context, array $schema ): array {
		$values = array(
			'form_id'          => (int) $context->formId,
			'form_title'       => (string) ( $schema['metadata']['title'] ?? ( $schema['metadata']['name'] ?? '' ) ),
			'submission_id'    => (int) $context->getMeta( 'submission_id', 0 ),
			'created_at'       => gmdate( 'c' ),
			'status'           => (string) $context->getMeta( 'entry_status', '' ),
			'page_url'         => (string) $context->getMeta( 'request_page_url', '' ),
			'ip_address'       => (string) $context->getMeta( 'request_ip', '' ),
			'user_agent'       => (string) $context->getMeta( 'request_user_agent', '' ),
			'user_id'          => (int) $context->getMeta( 'request_user_id', 0 ),
		);
		return self::addonEntryValues( $values, $context, $schema );
	}

	/**
	 * Entry values an add-on adds for its payload groups.
	 *
	 * @param array      $values  Values so far.
	 * @param mixed|null $context Submission context, or null for a sample.
	 * @param array      $schema  Form schema.
	 * @return array
	 */
	public static function addonEntryValues( array $values, $context, array $schema ): array {
		/**
		 * Values the "selected" payload can send for an add-on's own groups
		 * (see `subtleforms/webhooks/payload_groups`). With a null context
		 * the values are for the sample in the builder.
		 *
		 * @param array      $values  Key to value.
		 * @param mixed|null $context Submission context, or null.
		 * @param array      $schema  Form schema.
		 * @since 2.7.2
		 */
		$more = apply_filters( 'subtleforms/webhooks/entry_values', $values, $context, $schema );
		return is_array( $more ) ? $more + $values : $values;
	}

	/**
	 * Extra groups of the "selected" payload, from add-ons: group name to its
	 * keys. Each key starts with the group name and an underscore; the body
	 * sends a ticked key under the group name without that prefix, so
	 * `example_total` is sent as `{ "example": { "total": ... } }`.
	 *
	 * @param array $schema Form schema.
	 * @return array<string,string[]>
	 */
	public static function payloadGroups( array $schema ): array {
		/**
		 * Extra groups of the "selected" webhook payload.
		 *
		 * @param array $groups Group name to keys.
		 * @param array $schema Form schema.
		 * @since 2.7.2
		 */
		$groups = apply_filters( 'subtleforms/webhooks/payload_groups', array(), $schema );
		$out    = array();
		foreach ( is_array( $groups ) ? $groups : array() as $name => $keys ) {
			$name = sanitize_key( (string) $name );
			if ( '' === $name || in_array( $name, array( 'event', 'fields', 'answers' ), true ) || ! is_array( $keys ) ) {
				continue;
			}
			$out[ $name ] = array_values( array_filter( array_map( 'strval', $keys ), static fn( $k ) => 0 === strpos( $k, $name . '_' ) ) );
		}
		return $out;
	}

	/**
	 * The fields a "selected" payload may send: every answer-bearing field
	 * of the form except the types in SENSITIVE_TYPES, by key.
	 *
	 * @param array $schema Form schema.
	 * @return array<string,array> Key to FieldMapper::fields() row.
	 */
	public static function sendableFields( array $schema ): array {
		$out = array();
		foreach ( FieldMapper::fields( $schema ) as $row ) {
			if ( in_array( $row['type'], self::SENSITIVE_TYPES, true ) || in_array( $row['type'], \SubtleForms\Fields\FieldTypeAvailability::noAnswerTypes(), true ) || EntryValues::isSecret( $row['field'] ) || isset( $out[ $row['key'] ] ) ) {
				continue;
			}
			$out[ $row['key'] ] = $row;
		}
		return $out;
	}

	/**
	 * Answers as stored, by field key, for the {{raw:key}} tag of a custom
	 * body. Sensitive fields are left out.
	 *
	 * @param array $schema  Form schema.
	 * @param array $answers Answers from answers().
	 * @return array
	 */
	public static function rawAnswers( array $schema, array $answers ): array {
		$formatted = $schema ? AnswerFormatter::withChainedLabels( $schema, $answers ) : $answers;
		$allowed   = self::sendableFields( $schema );
		return $schema ? array_intersect_key( $formatted, $allowed ) : $formatted;
	}

	/**
	 * The JSON body of the "selected" payload mode: only what was ticked.
	 * Unknown keys and fields that are no longer on the form are skipped,
	 * and sensitive fields are never sent, whatever the settings say.
	 *
	 * @param array $schema   Form schema.
	 * @param array $answers  Answers from answers().
	 * @param array $entry    Values from entryValues().
	 * @param array $selected Ticked keys.
	 * @return array
	 */
	public static function selectedBody( array $schema, array $answers, array $entry, array $selected ): array {
		$selected = array_values( array_unique( array_filter( array_map( 'strval', $selected ) ) ) );
		$body     = array( 'event' => 'submission.created' );

		$ints = array( 'form_id', 'submission_id', 'user_id' );
		foreach ( array_merge( self::FORM_KEYS, self::SUBMISSION_KEYS ) as $key ) {
			if ( ! in_array( $key, $selected, true ) ) {
				continue;
			}
			$value        = $entry[ $key ] ?? '';
			$body[ $key ] = in_array( $key, $ints, true ) ? (int) $value : (string) $value;
		}

		$sendable = self::sendableFields( $schema );
		$keys     = array();
		foreach ( $sendable as $key => $row ) {
			if ( in_array( self::FIELD_PREFIX . $key, $selected, true ) ) {
				$keys[] = $key;
			}
		}
		if ( $keys ) {
			$formatted = $schema ? AnswerFormatter::withChainedLabels( $schema, $answers ) : $answers;
			$fields    = array();
			$labelled  = array();
			foreach ( $keys as $key ) {
				$fields[ $key ] = array_key_exists( $key, $formatted ) ? $formatted[ $key ] : null;
				$labelled[]     = array(
					'key'   => $key,
					'label' => (string) $sendable[ $key ]['label'],
					'value' => $fields[ $key ],
				);
			}
			$body['fields'] = (object) $fields;
			if ( in_array( self::LABELS_OPTION, $selected, true ) ) {
				$body['answers'] = $labelled;
			}
		}

		foreach ( self::payloadGroups( $schema ) as $group => $groupKeys ) {
			$picked = array();
			foreach ( $groupKeys as $key ) {
				if ( in_array( $key, $selected, true ) ) {
					$picked[ substr( $key, strlen( $group ) + 1 ) ] = $entry[ $key ] ?? null;
				}
			}
			if ( $picked ) {
				$body[ $group ] = $picked;
			}
		}

		return $body;
	}
}
