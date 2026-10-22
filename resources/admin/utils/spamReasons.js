import { __ } from '@wordpress/i18n';

/**
 * Why a submission was blocked, in plain words (2.6.0). Keys match
 * SpamStats::REASONS on the server.
 *
 * @return {Object<string, string>}
 */
export function spamReasonLabels() {
  return {
    honeypot: __('Hidden trap field', 'subtleforms'),
    time_trap: __('Sent too fast', 'subtleforms'),
    rate_limit: __('Too many tries', 'subtleforms'),
    captcha_failed: __('Failed CAPTCHA', 'subtleforms'),
    spam_rule: __('Marked as spam by a rule', 'subtleforms'),
    other: __('Other checks', 'subtleforms'),
  };
}

/**
 * Reasons with a count above zero, largest first, with their labels.
 *
 * @param {Object<string, number>} reasons Counts by reason.
 * @return {Array<{key: string, label: string, count: number}>}
 */
export function spamReasonRows(reasons = {}) {
  const labels = spamReasonLabels();
  return Object.keys(labels)
    .map((key) => ({ key, label: labels[key], count: Number(reasons?.[key] || 0) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}
