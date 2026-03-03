<?php
/**
 * SubtleForms REST API Response Helper
 *
 * Provides standardized response format for all REST endpoints.
 * Ensures consistent success/error shapes across the entire API.
 *
 * @package   SubtleForms\Api
 * @version   1.8.1
 * @since     1.8.1
 */

namespace SubtleForms\Api;

use WP_REST_Response;

/**
 * API Response helper class
 *
 * Standardizes REST API responses with consistent structure:
 * - Success: { data: ..., meta: {...} }
 * - Error: { error: { code, message, meta } }
 */
final class ApiResponse {

	/**
	 * Create a success response.
	 *
	 * @param mixed $data    Response data (any type).
	 * @param int   $status  HTTP status code (default 200).
	 * @param array $meta    Optional metadata (pagination, etc.).
	 * @return WP_REST_Response
	 */
	public static function success( $data, int $status = 200, array $meta = [] ): WP_REST_Response {
		$response = array( 'data' => $data );

		if ( ! empty( $meta ) ) {
			$response['meta'] = $meta;
		}

		return new WP_REST_Response( $response, $status );
	}

	/**
	 * Add headers to a WP_REST_Response.
	 *
	 * Phase A3-P2: Helper for adding ETag and other headers.
	 *
	 * @param WP_REST_Response $response Response object.
	 * @param array            $headers  Headers to add.
	 * @return WP_REST_Response
	 */
	public static function withHeaders( WP_REST_Response $response, array $headers ): WP_REST_Response {
		foreach ( $headers as $key => $value ) {
			$response->header( $key, (string) $value );
		}
		return $response;
	}

	/**
	 * Create an error response.
	 *
	 * @param string $code    Machine-readable error code.
	 * @param string $message Human-readable error message.
	 * @param int    $status  HTTP status code (default 400).
	 * @param array  $meta    Optional error metadata.
	 * @return WP_REST_Response
	 */
	public static function error( string $code, string $message, int $status = 400, array $meta = [] ): WP_REST_Response {
		$response = array(
			'error' => array(
				'code'    => $code,
				'message' => $message,
			),
		);

		if ( ! empty( $meta ) ) {
			$response['error']['meta'] = $meta;
		}

		return new WP_REST_Response( $response, $status );
	}

	/**
	 * Create a 404 Not Found response.
	 *
	 * @param string $message Error message.
	 * @param array  $meta    Optional metadata.
	 * @return WP_REST_Response
	 */
	public static function not_found( string $message = 'Resource not found', array $meta = [] ): WP_REST_Response {
		return self::error( 'not_found', $message, 404, $meta );
	}

	/**
	 * Create a 403 Forbidden response.
	 *
	 * @param string $message Error message.
	 * @param array  $meta    Optional metadata.
	 * @return WP_REST_Response
	 */
	public static function forbidden( string $message = 'Forbidden', array $meta = [] ): WP_REST_Response {
		return self::error( 'forbidden', $message, 403, $meta );
	}

	/**
	 * Create a 401 Unauthorized response.
	 *
	 * @param string $message Error message.
	 * @param array  $meta    Optional metadata.
	 * @return WP_REST_Response
	 */
	public static function unauthorized( string $message = 'Unauthorized', array $meta = [] ): WP_REST_Response {
		return self::error( 'unauthorized', $message, 401, $meta );
	}

	/**
	 * Create a 400 Bad Request response.
	 *
	 * @param string $message Error message.
	 * @param array  $meta    Optional metadata.
	 * @return WP_REST_Response
	 */
	public static function bad_request( string $message = 'Bad request', array $meta = [] ): WP_REST_Response {
		return self::error( 'bad_request', $message, 400, $meta );
	}

	/**
	 * Create a 422 Unprocessable Entity response (validation errors).
	 *
	 * Reserved for Phase A2 validation implementation.
	 *
	 * @param string $message Error message.
	 * @param array  $fields  Field-level errors: ['field_name' => 'error message'].
	 * @return WP_REST_Response
	 */
	public static function validation_error( string $message = 'Validation failed', array $fields = [] ): WP_REST_Response {
		$meta = array();
		if ( ! empty( $fields ) ) {
			$meta['fields'] = $fields;
		}

		return self::error( 'validation_error', $message, 422, $meta );
	}

	/**
	 * Create a 409 Conflict response.
	 *
	 * Phase A3-P2: Optimistic locking implementation.
	 *
	 * @param string $message Error message.
	 * @param array  $meta    Optional metadata (e.g., current_etag, provided_if_match).
	 * @param array  $headers Optional headers (e.g., ETag with current value).
	 * @return WP_REST_Response
	 */
	public static function conflict( string $message = 'Resource version conflict', array $meta = array(), array $headers = array() ): WP_REST_Response {
		$response = self::error( 'version_conflict', $message, 409, $meta );
		
		// Add headers (e.g., ETag with current value)
		foreach ( $headers as $key => $value ) {
			$response->header( $key, (string) $value );
		}
		
		return $response;
	}

	/**
	 * Create a 429 Too Many Requests response.
	 *
	 * Phase A3-P1: Rate limiting implementation.
	 *
	 * @param string $message     Error message.
	 * @param int    $retry_after Seconds until retry allowed.
	 * @param array  $meta        Optional additional metadata.
	 * @param array  $headers     Optional additional headers (e.g., X-RateLimit-*).
	 * @return WP_REST_Response
	 */
	public static function rate_limited( string $message = 'Too many requests', int $retry_after = 60, array $meta = array(), array $headers = array() ): WP_REST_Response {
		// Merge retry_after into meta
		$meta['retry_after'] = $retry_after;
		
		$response = self::error( 'rate_limit_exceeded', $message, 429, $meta );
		
		// Set Retry-After header (required)
		$response->header( 'Retry-After', (string) $retry_after );
		
		// Set additional headers (e.g., X-RateLimit-* headers)
		foreach ( $headers as $key => $value ) {
			$response->header( $key, (string) $value );
		}
		
		return $response;
	}

	/**
	 * Create a 500 Internal Server Error response.
	 *
	 * @param string $message Error message.
	 * @param array  $meta    Optional metadata (avoid exposing sensitive data).
	 * @return WP_REST_Response
	 */
	public static function server_error( string $message = 'Internal server error', array $meta = [] ): WP_REST_Response {
		// In production, sanitize error details
		if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
			$meta = array(); // Don't expose internal details in production
		}

		return self::error( 'server_error', $message, 500, $meta );
	}

	/**
	 * Create a paginated success response with metadata.
	 *
	 * Convenience method for list endpoints with pagination.
	 *
	 * @param array $data       Response data.
	 * @param int   $total      Total items available.
	 * @param int   $page       Current page number.
	 * @param int   $per_page   Items per page.
	 * @return WP_REST_Response
	 */
	public static function paginated( array $data, int $total, int $page, int $per_page ): WP_REST_Response {
		$total_pages = $per_page > 0 ? ceil( $total / $per_page ) : 0;

		$meta = array(
			'page'        => $page,
			'per_page'    => $per_page,
			'total'       => $total,
			'total_pages' => (int) $total_pages,
		);

		return self::success( $data, 200, $meta );
	}
}

