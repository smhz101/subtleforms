<?php
/**
 * Subtle Forms
 *
 * @package   SubtleForms\Support
 * @version   0.1.0
 */
namespace SubtleForms\Support;

/**
 * Debug logger (WP_DEBUG aware).
 */
class Logger
{
    public function info($message)
    {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[MPF][INFO] ' . $message);
        }
    }

    public function error($message)
    {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[MPF][ERROR] ' . $message);
        }
    }
}
