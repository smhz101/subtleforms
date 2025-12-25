<?php

/**
 * Subtle Forms
 *
 * @package   SubtleForms\Support
 * @version   0.1.0
 */

namespace SubtleForms\Support;

/**
 * Global helper accessors.
 * You can later replace these with your Container calls.
 */
final class Helpers {
  public static function caps(): Capabilities {
    static $caps = null;

    if (!$caps) {
      $caps = new Capabilities();
    }

    return $caps;
  }
  
  public static function gate(): FeatureGate {
    static $gate = null;

    if (!$gate) {
      $gate = new FeatureGate(self::caps());
    }

    return $gate;
  }

  /**
   * Defensive normalization helpers for PHP 7.2+ compatibility
   * Prevents null values from reaching WordPress core string functions
   */

  /**
   * Normalize value to string, preventing null from reaching WP core functions
   * 
   * @param mixed $value
   * @return string
   */
  public static function normalize_string($value): string
  {
    if ($value === null) {
      return '';
    }
    
    if (is_scalar($value)) {
      return (string) $value;
    }
    
    if (is_array($value) || is_object($value)) {
      return '';
    }
    
    return '';
  }

  /**
   * Normalize value to array, preventing null/invalid types
   * 
   * @param mixed $value
   * @return array
   */
  public static function normalize_array($value): array
  {
    if ($value === null) {
      return [];
    }
    
    if (is_array($value)) {
      return $value;
    }
    
    return [];
  }

  /**
   * Normalize scalar value, handling null safely
   * 
   * @param mixed $value
   * @param mixed $default Default value if null or non-scalar
   * @return mixed
   */
  public static function normalize_scalar($value, $default = '')
  {
    if ($value === null) {
      return $default;
    }
    
    if (is_scalar($value)) {
      return $value;
    }
    
    return $default;
  }

  /**
   * Safe sanitize_text_field wrapper
   * 
   * @param mixed $value
   * @return string
   */
  public static function safe_sanitize_text($value): string
  {
    return sanitize_text_field(self::normalize_string($value));
  }

  /**
   * Safe esc_html wrapper
   * 
   * @param mixed $value
   * @return string
   */
  public static function safe_esc_html($value): string
  {
    return esc_html(self::normalize_string($value));
  }

  /**
   * Safe esc_attr wrapper
   * 
   * @param mixed $value
   * @return string
   */
  public static function safe_esc_attr($value): string
  {
    return esc_attr(self::normalize_string($value));
  }

  /**
   * Safe esc_url wrapper
   * 
   * @param mixed $value
   * @return string
   */
  public static function safe_esc_url($value): string
  {
    return esc_url(self::normalize_string($value));
  }

  /**
   * Safe wp_kses wrapper
   * 
   * @param mixed $value
   * @param array $allowed_html
   * @return string
   */
  public static function safe_wp_kses($value, array $allowed_html = []): string
  {
    return wp_kses(self::normalize_string($value), $allowed_html);
  }

  /**
   * Safe array key getter with normalization
   * 
   * @param array $array
   * @param string $key
   * @param mixed $default
   * @return mixed
   */
  public static function safe_array_get(array $array, string $key, $default = '')
  {
    if (!array_key_exists($key, $array)) {
      return $default;
    }
    
    $value = $array[$key];
    
    if ($value === null) {
      return $default;
    }
    
    return $value;
  }

  /**
   * Safe string array key getter
   * 
   * @param array $array
   * @param string $key
   * @param string $default
   * @return string
   */
  public static function safe_string_get(array $array, string $key, string $default = ''): string
  {
    return self::normalize_string(self::safe_array_get($array, $key, $default));
  }

  /**
   * Safe JSON decode with fallback
   * 
   * @param mixed $json JSON string to decode
   * @param bool $assoc Return associative array when true
   * @param mixed $default Default value if decode fails
   * @return mixed
   */
  public static function safe_json_decode($json, bool $assoc = false, mixed $default = null)
  {
    $json = self::normalize_string($json);
    
    if (empty($json)) {
      return $assoc ? [] : ($default ?? new \stdClass());
    }
    
    $decoded = json_decode($json, $assoc);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
      return $assoc ? [] : ($default ?? new \stdClass());
    }
    
    return $decoded;
  }

  /**
   * Safe JSON encode with fallback
   * 
   * @param mixed $value Value to encode
   * @param string $default Default JSON if encode fails
   * @return string
   */
  public static function safe_json_encode($value, string $default = '{}'): string
  {
    $encoded = wp_json_encode($value);
    
    if ($encoded === false) {
      return $default;
    }
    
    return $encoded;
  }
}
