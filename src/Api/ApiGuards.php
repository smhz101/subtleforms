<?php
/**
 * Shared REST API helpers: rate limiting, ETag, permissions.
 *
 * @package SubtleForms\Api
 * @since   1.9.0
 */

namespace SubtleForms\Api;

use SubtleForms\Security\RateLimiter;
use SubtleForms\Security\ETag;
use SubtleForms\Support\FeatureGate;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Trait providing common REST middleware used by all domain API classes.
 */
trait ApiGuards {

	/**
	 * Guard rate limit for request.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|null Error response if rate limited, null if allowed.
	 */
	protected function guardRateLimit( WP_REST_Request $request ): ?WP_REST_Response {
		$userId = get_current_user_id() ?: null;
		$ip     = isset( $_SERVER['REMOTE_ADDR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: '0.0.0.0';
		$route  = $request->get_route();
		$method = $request->get_method();

		$policy = RateLimiter::policy( $route, $method );
		$key    = RateLimiter::buildKey( $route, $method, $userId, $ip );
		$result = RateLimiter::check( $key, $policy['limit'], $policy['window'] );

		if ( ! $result['allowed'] ) {
			$headers = RateLimiter::headers( $result, $policy['limit'] );
			return ApiResponse::rate_limited(
				'Too many requests. Please try again later.',
				$result['retry_after'],
				array(),
				$headers
			);
		}

		return null;
	}

	/**
	 * Guard If-Match for optimistic locking.
	 *
	 * @param WP_REST_Request $request         Request object.
	 * @param array           $currentResource Current resource data.
	 * @param string          $resourceName    Resource type (e.g. "form", "submission").
	 * @return WP_REST_Response|null 409 response if conflict, null if allowed.
	 */
	protected function guardIfMatch( WP_REST_Request $request, array $currentResource, string $resourceName ): ?WP_REST_Response {
		$ifMatch = $request->get_header( 'If-Match' );

		if ( empty( $ifMatch ) ) {
			return null;
		}

		$currentETag = $this->generateETag( $currentResource, $resourceName );

		if ( ETag::match( $ifMatch, $currentETag ) ) {
			return null;
		}

		return ApiResponse::conflict(
			sprintf( 'The %s has been modified by another user. Please refresh and try again.', $resourceName ),
			array(
				'resource'          => $resourceName,
				'provided_if_match' => $ifMatch,
				'current_etag'      => $currentETag,
			),
			array( 'ETag' => $currentETag )
		);
	}

	/**
	 * Generate ETag for a resource.
	 *
	 * @param array  $resource     Resource data.
	 * @param string $resourceName Resource type.
	 * @return string ETag value.
	 */
	protected function generateETag( array $resource, string $resourceName ): string {
		switch ( $resourceName ) {
			case 'form':
				return ETag::fromForm( $resource );
			case 'submission':
				return ETag::fromSubmission( $resource );
			default:
				return ETag::fromResource( $resource );
		}
	}

	/**
	 * Check if user can read.
	 */
	public function check_read_permission(): bool {
		if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		return (bool) $this->getGate()->allows( 'api.read' );
	}

	/**
	 * Check if user can write.
	 */
	public function check_write_permission(): bool {
		if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		return (bool) $this->getGate()->allows( 'api.write' );
	}

	/**
	 * Get the FeatureGate instance.
	 *
	 * Classes using this trait must implement this method to return
	 * their injected FeatureGate dependency.
	 */
	abstract protected function getGate(): FeatureGate;
}
