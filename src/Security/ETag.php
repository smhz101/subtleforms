<?php
/**
 * ETag Utility for Optimistic Locking
 *
 * Provides ETag generation and validation for REST API resources
 * to enable optimistic concurrency control via If-Match headers.
 *
 * @package SubtleForms
 * @subpackage Security
 * @since Phase A3-P2
 */

namespace SubtleForms\Security;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * ETag utility for optimistic locking
 */
class ETag
{
    /**
     * Generate a weak ETag
     *
     * Weak ETags indicate semantic equivalence but allow for minor differences.
     * Format: W/"<value>"
     *
     * @param string $value Hash or identifier
     * @return string Weak ETag
     */
    public static function weak(string $value): string
    {
        return sprintf('W/"%s"', $value);
    }

    /**
     * Generate ETag from resource data
     *
     * Attempts to use timestamp-based versioning first, falls back to content hash.
     *
     * @param array $resource Resource data (e.g., form, submission)
     * @param array $fields Optional specific fields to include in hash
     * @return string ETag value (strong or weak)
     */
    public static function fromResource(array $resource, array $fields = []): string
    {
        // Priority 1: Use timestamp-based version hints (most reliable)
        $timestampFields = ['updated_at', 'updatedAt', 'modified', 'date_modified_gmt', 'modified_gmt'];
        
        foreach ($timestampFields as $field) {
            if (isset($resource[$field]) && !empty($resource[$field])) {
                // Use timestamp + ID for uniqueness
                $identifier = $resource['id'] ?? 'unknown';
                $timestamp = is_numeric($resource[$field]) 
                    ? $resource[$field] 
                    : strtotime($resource[$field]);
                $hash = md5($identifier . '_' . $timestamp);
                return self::weak($hash);
            }
        }

        // Priority 2: Use explicit version/revision fields
        $versionFields = ['version', 'revision', 'rev'];
        
        foreach ($versionFields as $field) {
            if (isset($resource[$field]) && !empty($resource[$field])) {
                $identifier = $resource['id'] ?? 'unknown';
                $hash = md5($identifier . '_' . $resource[$field]);
                return self::weak($hash);
            }
        }

        // Priority 3: Hash stable content
        if (!empty($fields)) {
            // Use only specified fields
            $data = array_intersect_key($resource, array_flip($fields));
        } else {
            // Use entire resource
            $data = $resource;
        }

        // Remove unstable fields that change without meaningful updates
        unset($data['views'], $data['access_count'], $data['last_viewed']);

        // Sort for stable hash
        ksort($data);
        $hash = md5(wp_json_encode($data));
        
        return self::weak($hash);
    }

    /**
     * Check if If-Match header matches current ETag
     *
     * @param string|null $ifMatch If-Match header value
     * @param string $currentETag Current resource ETag
     * @return bool True if match or no If-Match provided
     */
    public static function match(?string $ifMatch, string $currentETag): bool
    {
        // No If-Match header = no locking required
        if (empty($ifMatch)) {
            return true;
        }

        // If-Match: * always matches (RFC 7232)
        if (trim($ifMatch) === '*') {
            return true;
        }

        // Parse multiple ETags from If-Match header
        $etags = self::parseIfMatchHeader($ifMatch);

        // Normalize current ETag for comparison
        $normalizedCurrent = self::normalizeETag($currentETag);

        // Check if any provided ETag matches
        foreach ($etags as $etag) {
            if (self::normalizeETag($etag) === $normalizedCurrent) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parse If-Match header into array of ETags
     *
     * Handles multiple ETags: If-Match: "etag1", "etag2"
     *
     * @param string $header If-Match header value
     * @return array Array of ETag values
     */
    public static function parseIfMatchHeader(string $header): array
    {
        $header = trim($header);
        
        if (empty($header)) {
            return [];
        }

        // Handle If-Match: *
        if ($header === '*') {
            return ['*'];
        }

        // Split by comma and clean up
        $etags = array_map('trim', explode(',', $header));
        
        return array_filter($etags);
    }

    /**
     * Normalize ETag for comparison
     *
     * Removes quotes and W/ prefix to compare core value.
     * For our use case, we treat weak and strong ETags equivalently.
     *
     * @param string $etag ETag value
     * @return string Normalized ETag (just the hash)
     */
    private static function normalizeETag(string $etag): string
    {
        $etag = trim($etag);
        
        // Remove W/ prefix if present
        if (strpos($etag, 'W/') === 0) {
            $etag = substr($etag, 2);
        }
        
        // Remove surrounding quotes
        $etag = trim($etag, '"');
        
        return $etag;
    }

    /**
     * Generate ETag for a form resource
     *
     * @param array $form Form data
     * @return string ETag
     */
    public static function fromForm(array $form): string
    {
        // Use updated_at if available, otherwise hash key fields
        if (isset($form['updated_at']) || isset($form['modified'])) {
            return self::fromResource($form);
        }

        // Hash stable form attributes
        $fields = ['id', 'title', 'status', 'config', 'updated_at', 'created_at'];
        return self::fromResource($form, $fields);
    }

    /**
     * Generate ETag for a submission resource
     *
     * @param array $submission Submission data
     * @return string ETag
     */
    public static function fromSubmission(array $submission): string
    {
        // Use updated_at if available
        if (isset($submission['updated_at']) || isset($submission['modified'])) {
            return self::fromResource($submission);
        }

        // Hash stable submission attributes
        $fields = ['id', 'status', 'notes', 'data', 'updated_at'];
        return self::fromResource($submission, $fields);
    }

    /**
     * Generate ETag for settings
     *
     * Uses settings version from WordPress options or hashes entire settings array.
     *
     * @param array $settings Settings data
     * @return string ETag
     */
    public static function fromSettings(array $settings): string
    {
        // Check for version option
        $version = get_option('subtleforms_settings_version', 1);
        
        if ($version) {
            $hash = md5('settings_' . $version);
            return self::weak($hash);
        }

        // Fallback: hash entire settings
        ksort($settings);
        $hash = md5(wp_json_encode($settings));
        return self::weak($hash);
    }

    /**
     * Increment settings version
     *
     * Call this after successful settings update.
     *
     * @return int New version number
     */
    public static function incrementSettingsVersion(): int
    {
        $version = (int) get_option('subtleforms_settings_version', 1);
        $newVersion = $version + 1;
        update_option('subtleforms_settings_version', $newVersion);
        return $newVersion;
    }
}
