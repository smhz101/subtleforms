/**
 * Shared date formatting for the admin (Part B8).
 *
 * One helper, used by the Dashboard, All Forms and submissions screens so a
 * date reads the same everywhere. It respects the site's WordPress date/time
 * format (Settings → General) via @wordpress/date, falling back to a stable
 * locale string when that library is not available (e.g. unit tests).
 */

import { __ } from '@wordpress/i18n';

let wpDate = null;
try {
  // Imported lazily so test environments without @wordpress/date still load
  // this module — the fallback path is used there.
  wpDate = require('@wordpress/date');
} catch (e) {
  wpDate = null;
}

/**
 * The site's configured date format, when available.
 *
 * @return {string|null}
 */
function siteDateFormat() {
  // wp.date.settings is populated by @wordpress/date from the WP global.
  if (wpDate && wpDate.settings && wpDate.settings.dateFormat) {
    return wpDate.settings.dateFormat;
  }
  return null;
}

/**
 * Format a date for display.
 *
 * Accepts anything Date can parse (ISO string, naive UTC "YYYY-MM-DD HH:MM:SS",
 * epoch, Date). Naive UTC strings are normalised to an explicit UTC instant
 * first so JS does not read them as local time (the "5 hours off" bug).
 *
 * @param {string|number|Date} value Date value.
 * @param {string}              fallbackFormat Fallback format when WP's is unavailable.
 * @return {string} Formatted date.
 */
export function formatDate(value, fallbackFormat = 'M j, Y') {
  if (!value) return '';

  const raw = String(value);
  const iso =
    raw && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';

  if (wpDate && typeof wpDate.dateI18n === 'function') {
    const format = siteDateFormat() || fallbackFormat;
    try {
      return wpDate.dateI18n(format, date);
    } catch (e) {
      // fall through to locale string
    }
  }

  return date.toLocaleDateString();
}

/**
 * Relative "time ago" text for recent dates, falling back to formatDate.
 *
 * @param {string|number|Date} value Date value.
 * @return {string}
 */
export function formatRelativeDate(value) {
  if (!value) return '';

  const raw = String(value);
  const iso =
    raw && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return __('Just now', 'subtleforms');
  if (diffHours < 24) {
    return sprintfHoursAgo(diffHours);
  }
  if (diffHours < 48) return __('Yesterday', 'subtleforms');

  return formatDate(value);
}

function sprintfHoursAgo(hours) {
  // Kept inline so the helper stays dependency-free in test envs.
  /* translators: %1$d: number of hours ago */
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

/**
 * Whether a form is "new" — created within the last 7 days (Part B7).
 *
 * @param {object} form Form object with created_at.
 * @return {boolean}
 */
export function isNewForm(form) {
  if (!form || !form.created_at) return false;
  const raw = String(form.created_at);
  const iso =
    raw && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? `${raw.replace(' ', 'T')}Z`
      : raw;
  const created = new Date(iso);
  if (isNaN(created.getTime())) return false;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return new Date() - created < sevenDaysMs;
}
