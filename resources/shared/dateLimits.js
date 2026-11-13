/**
 * The limits of a Date, Time or Date & time field in the browser: earliest and
 * latest date, no past dates, unavailable weekdays and the allowed times.
 * Mirrors SubtleForms\Engine\DateRules, message for message.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
  formatPhp,
  isIsoDate,
  parseIsoDate,
  parseTime,
  resolveDateLimit,
  resolveFormat,
  siteLocale,
  siteNow,
  splitFormat,
  toIsoDate,
} from './dateTime';

const clock = (value) => {
  const parsed = parseTime(value);
  return parsed ? parsed.hours * 60 + parsed.minutes : null;
};

function showDate(iso, config, mode) {
  let format = resolveFormat(mode, config);
  if (mode === 'datetime') {
    format = splitFormat(format).date;
  }
  const day = parseIsoDate(iso);
  return day ? formatPhp(day, format || 'Y-m-d', siteLocale()) : iso;
}

function showTime(value, config, mode) {
  let format = resolveFormat(mode, config);
  if (mode === 'datetime') {
    format = splitFormat(format).time;
  }
  const parsed = parseTime(value);
  if (!parsed) {
    return value;
  }
  return formatPhp(new Date(2000, 0, 1, parsed.hours, parsed.minutes), format || 'H:i', siteLocale());
}

/**
 * The message for a date outside the field's limits, or an empty string.
 *
 * @param {string} date   YYYY-MM-DD.
 * @param {Object} config Field settings.
 * @param {string} mode   date or datetime.
 * @param {Date}   [now]  Today, for tests.
 */
export function dateLimitMessage(date, config = {}, mode = 'date', now = siteNow()) {
  const min = resolveDateLimit(config.minDate, now);
  const max = resolveDateLimit(config.maxDate, now);
  if (min && date < min) {
    // translators: %s: earliest allowed date
    return sprintf(__('Pick a date on or after %s.', 'subtleforms'), showDate(min, config, mode));
  }
  if (max && date > max) {
    // translators: %s: latest allowed date
    return sprintf(__('Pick a date on or before %s.', 'subtleforms'), showDate(max, config, mode));
  }
  if (config.disablePast === true && date < toIsoDate(now)) {
    return __('Pick a later date.', 'subtleforms');
  }
  const blocked = Array.isArray(config.disabledWeekdays) ? config.disabledWeekdays.map(Number) : [];
  const day = isIsoDate(date) ? parseIsoDate(date) : null;
  if (day && blocked.includes(day.getDay())) {
    const name = new Intl.DateTimeFormat(siteLocale(), { weekday: 'long' }).format(day);
    // translators: %s: weekday name, for example Monday.
    return sprintf(__('Not available on a %s.', 'subtleforms'), name);
  }
  return '';
}

/**
 * The message for a time outside the field's range, or an empty string.
 *
 * @param {string} value  HH:MM.
 * @param {Object} config Field settings.
 * @param {string} mode   time or datetime.
 */
export function timeLimitMessage(value, config = {}, mode = 'time') {
  const min = clock(config.minTime);
  const max = clock(config.maxTime);
  const at = clock(value);
  if (at === null || (min === null && max === null)) {
    return '';
  }
  if ((min !== null && at < min) || (max !== null && at > max)) {
    const low = min !== null ? String(config.minTime).slice(0, 5) : '00:00';
    const high = max !== null ? String(config.maxTime).slice(0, 5) : '23:59';
    // translators: 1: earliest time, 2: latest time
    return sprintf(__('Pick a time between %1$s and %2$s.', 'subtleforms'), showTime(low, config, mode), showTime(high, config, mode));
  }
  return '';
}
