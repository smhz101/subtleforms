<?php
/**
 * Webhook test request (2.4.1).
 *
 * Settings > Integrations > Webhooks and each webhook action can send a
 * sample entry to an address and show the answer. The request uses the same
 * address check, body and signing as a real delivery, so a test that
 * succeeds means entries are delivered too. Before 2.4.1 the test needed a
 * licensed SubtleForms Pro, so the button never worked on its own.
 *
 * @package SubtleForms
 * @since   2.4.1
 */

declare(strict_types=1);

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\Webhooks;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * POST /subtleforms/v1/webhooks/test
 */
final class WebhooksApi {

	const METHODS = array( 'POST', 'PUT', 'PATCH' );

	/**
	 * Register the route.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			'subtleforms/v1',
			'/webhooks/test',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'test' ),
				'permission_callback' => array( $this, 'checkPermissions' ),
				'args'                => array(
					'url'     => array(
						'type'     => 'string',
						'required' => true,
					),
					'method'  => array(
						'type' => 'string',
						'enum' => self::METHODS,
					),
					'headers' => array(
						'type' => 'object',
					),
					'sign'    => array(
						'type' => 'boolean',
					),
					'secret'  => array(
						'type' => 'string',
					),
					'payload_mode'   => array(
						'type' => 'string',
						'enum' => array( 'full', 'custom', 'selected' ),
					),
					'custom_payload' => array(
						'type' => 'string',
					),
					// The "selected" mode: the ticked keys, the form's fields and
					// example answers, as the builder shows them (2.5.0).
					'payload_selection' => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
					'fields'         => array(
						'type'  => 'array',
						'items' => array( 'type' => 'object' ),
					),
					'sample'         => array(
						'type' => 'object',
					),
					'form_title'     => array(
						'type' => 'string',
					),
					'form_id'        => array(
						'type' => 'integer',
					),
				),
			)
		);
	}

	/**
	 * Administrators only, with the REST nonce.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function checkPermissions( WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'subtleforms_forbidden', __( 'You are not allowed to perform this action.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'subtleforms_invalid_nonce', __( 'Security check failed. Please refresh and try again.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Send a sample entry and report the answer.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function test( WP_REST_Request $request ) {
		$built = self::build(
			array(
				'url'     => (string) $request->get_param( 'url' ),
				'method'  => (string) $request->get_param( 'method' ),
				'headers' => $request->get_param( 'headers' ),
				'sign'           => (bool) $request->get_param( 'sign' ),
				'secret'         => (string) $request->get_param( 'secret' ),
				'payload_mode'   => (string) $request->get_param( 'payload_mode' ),
				'custom_payload' => (string) $request->get_param( 'custom_payload' ),
				'payload_selection' => $request->get_param( 'payload_selection' ),
				'fields'         => $request->get_param( 'fields' ),
				'sample'         => $request->get_param( 'sample' ),
				'form_title'     => (string) $request->get_param( 'form_title' ),
				'form_id'        => (int) $request->get_param( 'form_id' ),
			)
		);
		if ( is_wp_error( $built ) ) {
			return ApiResponse::error( $built->get_error_code(), $built->get_error_message(), 400 );
		}

		// The safe client checks every redirect too, so a public address that
		// redirects to a local one is refused like the local address itself.
		$start    = microtime( true );
		$response = wp_safe_remote_request(
			$built['url'],
			array(
				'method'  => $built['method'],
				'headers' => $built['headers'],
				'body'    => $built['body'],
				'timeout' => 10,
			)
		);
		$ms = (int) round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $response ) ) {
			return ApiResponse::error(
				'subtleforms_webhook_failed',
				sprintf(
					/* translators: %s: error from the HTTP request */
					__( 'The request could not be sent: %s', 'subtleforms' ),
					$response->get_error_message()
				),
				400
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$ok   = $code >= 200 && $code < 300;

		return ApiResponse::success(
			array(
				'ok'            => $ok,
				'http_status'   => $code,
				'duration_ms'   => $ms,
				'signed'        => isset( $built['headers']['X-SubtleForms-Signature'] ),
				'response_body' => substr( (string) wp_remote_retrieve_body( $response ), 0, 300 ),
				'message'       => $ok
					/* translators: 1: HTTP status code, 2: milliseconds */
					? sprintf( __( 'Delivered. The endpoint answered HTTP %1$d in %2$d ms.', 'subtleforms' ), $code, $ms )
					/* translators: %d: HTTP status code */
					: sprintf( __( 'The endpoint answered HTTP %d, so real entries would be retried.', 'subtleforms' ), $code ),
			)
		);
	}

	/**
	 * The test request: address, method, headers and a sample body.
	 *
	 * @param array $args url, method, headers, sign, secret, payload_mode, custom_payload.
	 * @return array|WP_Error url, method, headers, body.
	 */
	public static function build( array $args ) {
		$url     = Webhooks::normalizeUrl( (string) ( $args['url'] ?? '' ) );
		$problem = Webhooks::urlProblem( $url );
		if ( $problem ) {
			return $problem;
		}

		$method = strtoupper( (string) ( $args['method'] ?? 'POST' ) );
		if ( ! in_array( $method, self::METHODS, true ) ) {
			$method = 'POST';
		}

		$title   = '' !== trim( (string) ( $args['form_title'] ?? '' ) ) ? sanitize_text_field( (string) $args['form_title'] ) : __( 'Test form', 'subtleforms' );
		$schema  = array(
			'metadata' => array( 'title' => $title ),
			'fields'   => array(
				array( 'id' => 'name', 'key' => 'name', 'type' => 'text', 'label' => __( 'Name', 'subtleforms' ) ),
				array( 'id' => 'email', 'key' => 'email', 'type' => 'email', 'label' => __( 'Email', 'subtleforms' ) ),
				array( 'id' => 'message', 'key' => 'message', 'type' => 'textarea', 'label' => __( 'Message', 'subtleforms' ) ),
			),
		);
		$answers = array(
			'name'    => 'Test Person',
			'email'   => 'test@example.com',
			'message' => __( 'This is a test webhook from SubtleForms.', 'subtleforms' ),
		);

		// An action test from the builder sends the form's own fields with the
		// example answers shown in "Data that will be sent" (2.5.0).
		$form_fields = array();
		foreach ( is_array( $args['fields'] ?? null ) ? $args['fields'] : array() as $field ) {
			if ( is_array( $field ) && ! empty( $field['key'] ) ) {
				$form_fields[] = array(
					'id'    => sanitize_key( (string) $field['key'] ),
					'key'   => sanitize_text_field( (string) $field['key'] ),
					'type'  => sanitize_key( (string) ( $field['type'] ?? 'text' ) ),
					'label' => sanitize_text_field( (string) ( $field['label'] ?? $field['key'] ) ),
				);
			}
		}
		if ( $form_fields ) {
			$schema['fields'] = $form_fields;
			$answers          = Webhooks::answers( is_array( $args['sample'] ?? null ) ? $args['sample'] : array(), $schema );
		}

		$sample_entry = array(
			'form_id'          => (int) ( $args['form_id'] ?? 0 ),
			'form_title'       => $title,
			'submission_id'    => 0,
			'created_at'       => gmdate( 'c' ),
			'status'           => 'completed',
			'page_url'         => home_url( '/contact/' ),
			'ip_address'       => '203.0.113.10',
			'user_agent'       => 'Mozilla/5.0 (sample)',
			'user_id'          => 0,
			'payment_amount'   => 0.0,
			'payment_currency' => '',
			'payment_status'   => '',
		);

		if ( 'selected' === ( $args['payload_mode'] ?? 'full' ) ) {
			// The ticked data, built with the same builder a real delivery uses.
			$selected         = is_array( $args['payload_selection'] ?? null ) ? $args['payload_selection'] : array();
			$body             = Webhooks::selectedBody( $schema, $answers, $sample_entry, $selected );
		} else {
			$body = Webhooks::fullBody(
				$schema,
				$answers,
				array(
					'form_id'       => $sample_entry['form_id'],
					'form_title'    => $title,
					'submission_id' => 0,
					'submitted_at'  => gmdate( 'c' ),
				)
			);
		}
		$body['test'] = true;
		$body         = (string) wp_json_encode( $body );

		// An action with a custom JSON body is tested with that body, filled
		// with the sample answers, as a real delivery would be.
		if ( 'custom' === ( $args['payload_mode'] ?? 'full' ) ) {
			$template = trim( (string) ( $args['custom_payload'] ?? '' ) );
			if ( '' === $template ) {
				$body = '{}';
			} else {
				$decoded = json_decode( $template, true );
				if ( JSON_ERROR_NONE !== json_last_error() ) {
					return new \WP_Error(
						'invalid_custom_payload',
						sprintf(
							/* translators: %s: JSON error */
							__( 'The custom JSON body is not valid: %s', 'subtleforms' ),
							json_last_error_msg()
						)
					);
				}
				$body = (string) wp_json_encode(
					\SubtleForms\Engine\Actions\WebhookAction::fillCustomPayload(
						$decoded,
						$answers,
						array(
							'form_title' => $title,
							'entry_id'   => '0',
							'entry'      => $sample_entry,
							'raw'        => Webhooks::rawAnswers( $schema, $answers ),
						)
					)
				);
			}
		}

		$headers = array_merge( array( 'Content-Type' => 'application/json' ), Webhooks::safeHeaders( $args['headers'] ?? array() ) );
		if ( ! empty( $args['sign'] ) ) {
			$secret = (string) ( $args['secret'] ?? '' );
			if ( '' === $secret ) {
				$global = get_option( 'subtleforms_settings', array() );
				$secret = is_array( $global ) ? (string) ( $global['ext_webhooks_signing_secret'] ?? '' ) : '';
			}
			if ( '' !== $secret ) {
				$headers['X-SubtleForms-Signature'] = Webhooks::signature( $body, $secret );
			}
		}

		return array(
			'url'     => $url,
			'method'  => $method,
			'headers' => $headers,
			'body'    => $body,
		);
	}
}
