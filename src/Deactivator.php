<?php
/**
 * SubtleForms Deactivator
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

/**
 * Handles plugin deactivation tasks.
 */
final class Deactivator
{
    /**
     * Deactivate the plugin.
     */
    public static function deactivate(): void
    {
        // Flush rewrite rules
        flush_rewrite_rules();

        // Clear any scheduled cron jobs
        self::clear_scheduled_events();

        // Store deactivation timestamp
        update_option('subtleforms_deactivated_at', time());

        // Allow extensions to hook into deactivation
        do_action('subtleforms/deactivated');
    }

    /**
     * Clear scheduled cron events.
     */
    private static function clear_scheduled_events(): void
    {
        $timestamp = wp_next_scheduled('subtleforms_cleanup');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'subtleforms_cleanup');
        }
    }
}
