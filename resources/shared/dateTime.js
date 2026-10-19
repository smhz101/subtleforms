/**
 * Date, time and date-time values.
 *
 * Stored values stay in the formats the rest of the plugin already accepts:
 * `YYYY-MM-DD`, `HH:MM`, and `YYYY-MM-DDTHH:MM`. The field's PHP-style
 * `format` is only used to present that value.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^(\d{2}):(\d{2})$/;

export function isIsoDate(value) {
  return ISO_DATE.test(String(value || ''));
}

export function parseIsoDate(value) {
  const match = ISO_DATE.exec(String(value || ''));
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseTime(value) {
  const match = CLOCK.exec(String(value || '').slice(0, 5));
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

export function toTime(hours, minutes) {
  const h = Math.min(23, Math.max(0, Number(hours) || 0));
  const m = Math.min(59, Math.max(0, Number(minutes) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function splitDateTime(value) {
  const raw = String(value || '');
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(raw);
  if (match) {
    return { date: match[1], time: match[2] };
  }
  if (isIsoDate(raw)) {
    return { date: raw, time: '' };
  }
  if (CLOCK.test(raw.slice(0, 5))) {
    return { date: '', time: raw.slice(0, 5) };
  }
  return { date: '', time: '' };
}

export function joinDateTime(date, time) {
  if (date && time) {
    return `${date}T${time}`;
  }
  return date || '';
}

export function isTwelveHour(format) {
  return /[ghaA]/.test(String(format || ''));
}

export function isIsoDateInRange(iso, min, max) {
  if (!iso) {
    return true;
  }
  if (isIsoDate(min) && iso < min) {
    return false;
  }
  if (isIsoDate(max) && iso > max) {
    return false;
  }
  return true;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function hour12(date) {
  const hour = date.getHours() % 12;
  return hour === 0 ? 12 : hour;
}

/**
 * Present a Date with a PHP `date()` format. Unknown letters are kept.
 * A backslash escapes the next character.
 *
 * @param {Date|null} date
 * @param {string} format
 * @return {string}
 */
export function formatPhp(date, format) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !format) {
    return '';
  }
  const token = {
    Y: () => String(date.getFullYear()),
    y: () => String(date.getFullYear()).slice(-2),
    m: () => pad(date.getMonth() + 1),
    n: () => String(date.getMonth() + 1),
    d: () => pad(date.getDate()),
    j: () => String(date.getDate()),
    F: () => new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date),
    M: () => new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date),
    H: () => pad(date.getHours()),
    G: () => String(date.getHours()),
    h: () => pad(hour12(date)),
    g: () => String(hour12(date)),
    i: () => pad(date.getMinutes()),
    A: () => (date.getHours() < 12 ? 'AM' : 'PM'),
    a: () => (date.getHours() < 12 ? 'am' : 'pm'),
  };
  let out = '';
  for (let i = 0; i < format.length; i += 1) {
    const ch = format[i];
    if (ch === '\\' && i + 1 < format.length) {
      i += 1;
      out += format[i];
      continue;
    }
    out += token[ch] ? token[ch]() : ch;
  }
  return out;
}

/** Six weeks of days, Sunday first, covering the month that contains `cursor`. */
export function siteLocale() {
  if (typeof window !== 'undefined' && window.subtleformsFrontend && window.subtleformsFrontend.locale) {
    return window.subtleformsFrontend.locale;
  }
  return undefined;
}

export function siteWeekStart() {
  const raw = typeof window !== 'undefined' && window.subtleformsFrontend
    ? window.subtleformsFrontend.weekStartsOn
    : 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((value % 7) + 7) % 7;
}

export function dayName(date, locale) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function monthCells(cursor, weekStartsOn = 0) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOn = ((Number(weekStartsOn) % 7) + 7) % 7 || 0;
  const offset = (first.getDay() - startOn + 7) % 7;
  const start = new Date(first);
  start.setDate(1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}
