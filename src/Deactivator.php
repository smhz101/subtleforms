<?php

/**
 * SubtleForms Deactivator
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles plugin deactivation tasks.
 */
final class Deactivator {

	/**
	 * Deactivate the plugin.
	 */
	public static function deactivate(): void {
		// Flush rewrite rules
		flush_rewrite_rules();

		// Clear any scheduled cron jobs
		self::clear_scheduled_events();

		// Store deactivation timestamp
		update_option( 'subtleforms_deactivated_at', time() );

		// Allow extensions to hook into deactivation
		do_action( 'subtleforms/deactivated' );
	}

	/**
	 * Clear scheduled cron events.
	 */
	private static function clear_scheduled_events(): void {
		// Clear privacy cleanup cron
		$timestamp = wp_next_scheduled( 'subtleforms_daily_cleanup' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'subtleforms_daily_cleanup' );
		}

		// The analytics clean-up event moved to SubtleForms Pro in 2.7.0. A site
		// that scheduled it before keeps no stray event once this plugin is
		// deactivated.
		wp_clear_scheduled_hook( 'subtleforms_stats_prune' );

		// Clear the clean-up of uploads that were never submitted (2.1) and the
		// spam statistics prune.
		wp_clear_scheduled_hook( 'subtleforms_uploads_cleanup' );
		wp_clear_scheduled_hook( 'subtleforms_spam_stats_prune' );
	}
}
