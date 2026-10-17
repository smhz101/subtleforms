<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Analytics Extension
 *
 * Kept so the Extensions screen can show the Analytics entry. Counting and
 * reporting live in \SubtleForms\Analytics\Stats and
 * \SubtleForms\Api\AnalyticsApi (2.1): views are counted by a lightweight
 * beacon from the public form, submissions on `subtleforms/submission/completed`,
 * and both are stored as daily totals per form in `{prefix}subtleforms_stats`.
 *
 * The pre-2.1 option-based counters (`subtleforms_form_views` and
 * `subtleforms_submissions_count_{id}`) are no longer written.
 */
class AnalyticsExtension extends AbstractExtension {

	public function slug(): string {
		return 'analytics';
	}

	public function label(): string {
		return 'Analytics';
	}

	public function register(): void {
		// Nothing to register: see Analytics\Stats.
	}
}
