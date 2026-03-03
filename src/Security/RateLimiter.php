<?php
/**
 * Rate Limiter for SubtleForms REST API
 *
 * Implements lightweight, transient-based rate limiting with:
 * - Per-user and per-IP bucket strategies
 * - Endpoint-aware limits (read vs write)
 * - HTTP 429 response support with Retry-After headers
 * - Zero external dependencies
 *
 * @package SubtleForms
 * @subpackage Security
 * @since Phase A3-P1
 */

namespace SubtleForms\Security;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Rate limiter using WordPress transients for storage
 */
class RateLimiter
{
    /**
     * Check if request is allowed under rate limit
     *
     * @param string $key Unique identifier for this rate limit bucket
     * @param int $limit Maximum requests allowed in window
     * @param int $windowSeconds Time window in seconds
     * @return array {
     *     @type bool $allowed Whether request is allowed
     *     @type int $remaining Requests remaining in current window
     *     @type int $reset_in Seconds until window resets
     *     @type int $retry_after Seconds to wait before retry (only when blocked)
     * }
     */
    public static function check(string $key, int $limit, int $windowSeconds): array
    {
        $now = time();
        $transientKey = self::sanitizeTransientKey($key);
        
        // Get current bucket state
        $bucket = get_transient($transientKey);
        
        // Initialize or reset expired bucket
        if ($bucket === false || !is_array($bucket) || $bucket['reset_at'] <= $now) {
            $bucket = array(
                'count' => 0,
                'reset_at' => $now + $windowSeconds,
            );
        }
        
        $resetIn = $bucket['reset_at'] - $now;
        
        // Check if limit exceeded
        if ($bucket['count'] >= $limit) {
            return array(
                'allowed' => false,
                'remaining' => 0,
                'reset_in' => max(1, $resetIn), // Ensure at least 1 second
                'retry_after' => max(1, $resetIn),
            );
        }
        
        // Increment counter
        $bucket['count']++;
        set_transient($transientKey, $bucket, $resetIn);
        
        return array(
            'allowed' => true,
            'remaining' => max(0, $limit - $bucket['count']),
            'reset_in' => $resetIn,
            'retry_after' => 0,
        );
    }
    
    /**
     * Build rate limit key for a request
     *
     * @param string $route Request route (e.g. /subtleforms/v1/forms)
     * @param string $method HTTP method (GET, POST, etc.)
     * @param int|null $userId WordPress user ID if authenticated
     * @param string $ip Client IP address
     * @return string Unique rate limit key
     */
    public static function buildKey(string $route, string $method, ?int $userId, string $ip): string
    {
        // Prefer user-based limiting for authenticated requests
        if ($userId) {
            return sprintf('subtleforms_rl_user_%d_%s_%s', $userId, $method, md5($route));
        }
        
        // Fall back to IP-based limiting for anonymous requests
        $sanitizedIp = self::sanitizeIp($ip);
        return sprintf('subtleforms_rl_ip_%s_%s_%s', $sanitizedIp, $method, md5($route));
    }
    
    /**
     * Get rate limit policy for a route and method
     *
     * @param string $route Request route
     * @param string $method HTTP method
     * @return array {
     *     @type int $limit Maximum requests allowed
     *     @type int $window Time window in seconds
     * }
     */
    public static function policy(string $route, string $method): array
    {
        // Normalize route (strip leading namespace)
        $route = preg_replace('#^/subtleforms/v1#', '', $route);
        
        // Check if user is authenticated admin
        $isAuthenticatedAdmin = is_user_logged_in() && current_user_can('manage_options');
        
        // PUBLIC SUBMIT ENDPOINTS (strictest)
        if (preg_match('#^/forms/[^/]+/submit$#', $route) && $method === 'POST') {
            return array('limit' => 10, 'window' => 60);
        }
        
        // FORM SCHEMA ENDPOINTS (very lenient for authenticated admins due to autosave)
        if (preg_match('#^/forms/[^/]+/schema$#', $route) && $isAuthenticatedAdmin) {
            return array('limit' => 300, 'window' => 60);
        }
        
        // SETTINGS ENDPOINTS (strict for writes)
        if (preg_match('#^/settings#', $route) && in_array($method, array('POST', 'PUT', 'PATCH'), true)) {
            return array('limit' => 10, 'window' => 60);
        }
        
        // AUTHENTICATED ADMIN WRITE ENDPOINTS (lenient for builder UX)
        if ($isAuthenticatedAdmin && in_array($method, array('POST', 'PUT', 'PATCH', 'DELETE'), true)) {
            return array('limit' => 120, 'window' => 60);
        }
        
        // UNAUTHENTICATED WRITE ENDPOINTS (moderate)
        if (in_array($method, array('POST', 'PUT', 'PATCH', 'DELETE'), true)) {
            return array('limit' => 30, 'window' => 60);
        }
        
        // READ ENDPOINTS (lenient)
        if ($method === 'GET') {
            return array('limit' => 200, 'window' => 60);
        }
        
        // DEFAULT (safe fallback)
        return array('limit' => 60, 'window' => 60);
    }
    
    /**
     * Generate HTTP headers for rate limit response
     *
     * @param array $result Result from check() method
     * @param int $limit The limit that was checked against
     * @return array HTTP headers
     */
    public static function headers(array $result, int $limit): array
    {
        $headers = array(
            'X-RateLimit-Limit' => (string) $limit,
            'X-RateLimit-Remaining' => (string) $result['remaining'],
            'X-RateLimit-Reset' => (string) (time() + $result['reset_in']),
        );
        
        // Add Retry-After header only when blocked
        if (!$result['allowed']) {
            $headers['Retry-After'] = (string) $result['retry_after'];
        }
        
        return $headers;
    }
    
    /**
     * Sanitize transient key to meet WordPress constraints
     *
     * WordPress transient keys must be:
     * - Max 172 characters (wp_options.option_name is varchar(191), minus prefix)
     * - Alphanumeric + underscores only
     *
     * @param string $key Raw key
     * @return string Sanitized transient key
     */
    private static function sanitizeTransientKey(string $key): string
    {
        // Replace invalid characters with underscores
        $key = preg_replace('/[^a-zA-Z0-9_]/', '_', $key);
        
        // Truncate to safe length (leaving room for transient prefix)
        return substr($key, 0, 150);
    }
    
    /**
     * Sanitize IP address for use in transient keys
     *
     * @param string $ip Raw IP address
     * @return string Sanitized IP (hashed for privacy and key safety)
     */
    private static function sanitizeIp(string $ip): string
    {
        // Validate IP format
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            $ip = '0.0.0.0';
        }
        
        // Hash IP for privacy and to ensure valid transient key format
        return md5($ip);
    }
}
