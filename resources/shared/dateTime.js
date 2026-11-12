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

function intl(locale, options, date) {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch (e) {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

function ordinal(day) {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return 'th';
  }
  return { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
}

/**
 * Present a Date with a PHP `date()` format. Unknown letters are kept.
 * A backslash escapes the next character. Month and day names follow the
 * site language (siteLocale()), like wp_date() does on the server.
 *
 * @param {Date|null} date
 * @param {string}    format
 * @param {string}    [locale] BCP 47 tag; the site language by default.
 * @return {string}
 */
export function formatPhp(date, format, locale = siteLocale()) {
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
    S: () => ordinal(date.getDate()),
    D: () => intl(locale, { weekday: 'short' }, date),
    l: () => intl(locale, { weekday: 'long' }, date),
    N: () => String(date.getDay() === 0 ? 7 : date.getDay()),
    w: () => String(date.getDay()),
    F: () => intl(locale, { month: 'long' }, date),
    M: () => intl(locale, { month: 'short' }, date),
    H: () => pad(date.getHours()),
    G: () => String(date.getHours()),
    h: () => pad(hour12(date)),
    g: () => String(hour12(date)),
    i: () => pad(date.getMinutes()),
    s: () => pad(date.getSeconds()),
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

// ── Formats ──────────────────────────────────────────────────────────────

/** Letters that belong to the time part of a PHP format. */
const TIME_LETTERS = /[gGhHisaAU]/;

/** Presets offered in the builder, per field type (see CoreFields.php). */
export const FORMAT_PRESETS = {
  date: ['Y-m-d', 'd/m/Y', 'm/d/Y', 'd.m.Y', 'j F Y', 'D, j M Y'],
  time: ['H:i', 'g:i A'],
  datetime: ['Y-m-d H:i', 'd/m/Y H:i', 'm/d/Y g:i A', 'j F Y, g:i A'],
};

/** What each field type stores a value as when its format is not chosen. */
export const DEFAULT_FORMATS = { date: 'Y-m-d', time: 'H:i', datetime: 'Y-m-d H:i' };

/**
 * The date and time formats of the site (Settings > General), as the server
 * sends them next to the other front end settings.
 *
 * @return {{date: string, time: string}}
 */
export function siteFormats() {
  const source = (typeof window !== 'undefined' && (window.subtleformsFrontend || window.subtleformsAdmin)) || {};
  return {
    date: typeof source.dateFormat === 'string' && source.dateFormat ? source.dateFormat : 'F j, Y',
    time: typeof source.timeFormat === 'string' && source.timeFormat ? source.timeFormat : 'g:i a',
  };
}

/**
 * The PHP format a field presents its value with: its own format, the site
 * setting (`site`) or the text typed under Custom format (`custom`). A value
 * that is none of these is a format typed by hand in a saved 2.8 form and is
 * used as it is. Mirrors AnswerFormatter::format().
 *
 * @param {string} mode   date, time or datetime.
 * @param {Object} config Field settings (format, customFormat).
 * @return {string}
 */
export function resolveFormat(mode, config = {}) {
  const fallback = DEFAULT_FORMATS[mode] || DEFAULT_FORMATS.date;
  const raw = typeof config.format === 'string' ? config.format.trim() : '';
  if (raw === 'custom') {
    const custom = typeof config.customFormat === 'string' ? config.customFormat.trim() : '';
    return custom || fallback;
  }
  if (raw === 'site') {
    const site = siteFormats();
    if (mode === 'time') {
      return site.time;
    }
    return mode === 'datetime' ? `${site.date}, ${site.time}` : site.date;
  }
  return raw || fallback;
}

/**
 * Split a date and time format into its two parts. The separator between
 * them (a space, comma, "T" or "at") belongs to neither.
 *
 * @param {string} format
 * @return {{date: string, time: string}}
 */
export function splitFormat(format) {
  const text = String(format || '');
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') {
      i += 1;
      continue;
    }
    if (TIME_LETTERS.test(text[i])) {
      const head = text.slice(0, i).replace(/[\s,@\-T]+$/, '');
      return { date: head, time: text.slice(head.length).replace(/^[\s,@\-T]+/, '') };
    }
  }
  return { date: text, time: '' };
}

/** A fixed day the placeholder and the builder show formats with. */
export const EXAMPLE = new Date(2026, 10, 13, 14, 30);

/**
 * The format written out for an example day ("13/11/2026", "14:30"), in the
 * site language. Used as the placeholder.
 *
 * @param {string} format
 * @param {string} [locale]
 * @return {string}
 */
export function formatExample(format, locale = siteLocale()) {
  return formatPhp(EXAMPLE, format, locale);
}

// ── Typed input ──────────────────────────────────────────────────────────

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function monthNames(locale) {
  const names = [];
  [locale, 'en-US'].forEach((tag) => {
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(2024, month, 15);
      names.push({ month, name: intl(tag, { month: 'long' }, date).toLowerCase() });
      names.push({ month, name: intl(tag, { month: 'short' }, date).toLowerCase().replace(/\.$/, '') });
    }
  });
  // The longest names first, so "March" is not read as "Mar".
  return names.sort((a, b) => b.name.length - a.name.length);
}

function realDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function twoDigitYear(year) {
  return year < 70 ? 2000 + year : 1900 + year;
}

/**
 * Read text typed the way a PHP format writes it. Returns the parts the text
 * holds, or null when it does not fit the format.
 *
 * @param {string} text
 * @param {string} format
 * @param {string} [locale]
 * @return {{year?: number, month?: number, day?: number, hours?: number, minutes?: number, meridiem?: string}|null}
 */
export function parseWithFormat(text, format, locale = siteLocale()) {
  const input = String(text || '').trim();
  if (!input || !format) {
    return null;
  }
  const names = monthNames(locale);
  const groups = [];
  let pattern = '';
  for (let i = 0; i < format.length; i += 1) {
    const ch = format[i];
    if (ch === '\\' && i + 1 < format.length) {
      i += 1;
      pattern += escapeRegex(format[i]);
      continue;
    }
    switch (ch) {
      case 'd': case 'm': case 'H': case 'h': case 'i': case 's':
        groups.push(ch);
        pattern += '(\\d{2})';
        break;
      case 'j': case 'n': case 'G': case 'g':
        groups.push(ch);
        pattern += '(\\d{1,2})';
        break;
      case 'Y':
        groups.push(ch);
        pattern += '(\\d{4})';
        break;
      case 'y':
        groups.push(ch);
        pattern += '(\\d{2})';
        break;
      case 'F': case 'M':
        groups.push('F');
        pattern += `(${names.map((entry) => escapeRegex(entry.name)).join('|')})\\.?`;
        break;
      case 'D': case 'l':
        groups.push('-');
        pattern += '([^\\s,\\d]+)\\.?';
        break;
      case 'S':
        groups.push('-');
        pattern += '(st|nd|rd|th)';
        break;
      case 'A': case 'a':
        groups.push('A');
        pattern += '([ap]\\.?m\\.?)';
        break;
      default:
        pattern += /\s/.test(ch) ? '\\s+' : escapeRegex(ch);
    }
  }
  const match = new RegExp(`^${pattern}$`, 'i').exec(input.replace(/\s+/g, ' '));
  if (!match) {
    return null;
  }
  const out = {};
  for (let g = 0; g < groups.length; g += 1) {
    const value = match[g + 1];
    switch (groups[g]) {
      case 'd': case 'j': out.day = Number(value); break;
      case 'm': case 'n': out.month = Number(value); break;
      case 'Y': out.year = Number(value); break;
      case 'y': out.year = twoDigitYear(Number(value)); break;
      case 'F': out.month = names.find((entry) => entry.name === value.toLowerCase())?.month + 1; break;
      case 'H': case 'G': out.hours = Number(value); break;
      case 'h': case 'g': out.hours12 = Number(value); break;
      case 'i': out.minutes = Number(value); break;
      case 'A': out.meridiem = /^p/i.test(value) ? 'PM' : 'AM'; break;
      default: break;
    }
  }
  if (out.hours12 !== undefined) {
    if (out.hours12 < 1 || out.hours12 > 12) {
      return null;
    }
    out.hours = (out.hours12 % 12) + (out.meridiem === 'PM' ? 12 : 0);
    delete out.hours12;
  }
  if (out.hours !== undefined && (out.hours > 23 || (out.minutes ?? 0) > 59)) {
    return null;
  }
  if (out.minutes !== undefined && out.hours === undefined) {
    return null;
  }
  if (out.day !== undefined || out.month !== undefined || out.year !== undefined) {
    if (out.day === undefined || out.month === undefined || out.year === undefined || !realDate(out.year, out.month, out.day)) {
      return null;
    }
  }
  return out;
}

// The shapes people type whatever the field's format is.
const DATE_SHAPES = [
  { re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: 'ymd' },
  { re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: 'ymd' },
  { re: /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/, order: 'dmy' },
];

function parseDateShape(text) {
  const input = text.trim();
  for (const shape of DATE_SHAPES) {
    const match = shape.re.exec(input);
    if (!match) {
      continue;
    }
    const [a, b, c] = match.slice(1).map(Number);
    if (shape.order === 'ymd') {
      const date = realDate(a, b, c);
      return date ? { year: a, month: b, day: c } : null;
    }
    // Day first, then month first when the first number cannot be a month.
    if (realDate(c, b, a)) {
      return { year: c, month: b, day: a };
    }
    if (realDate(c, a, b)) {
      return { year: c, month: a, day: b };
    }
    return null;
  }
  return null;
}

function parseTimeShape(text) {
  const match = /^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*([ap]\.?m\.?)?$/i.exec(text.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59) {
    return null;
  }
  if (match[3]) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    return { hours: (hours % 12) + (/^p/i.test(match[3]) ? 12 : 0), minutes };
  }
  // A bare number is only a time when it has minutes ("14:30"), not "14".
  if (match[2] === undefined) {
    return null;
  }
  return hours > 23 ? null : { hours, minutes };
}

/**
 * Turn what a visitor typed into the stored value: the display format first,
 * then ISO and the common shapes (13/11/2026, 11/13/2026, 14:30, 2:30 pm).
 * Returns null when the text is none of them.
 *
 * @param {string} text   Typed text.
 * @param {string} mode   date, time or datetime.
 * @param {string} format The field's PHP format.
 * @param {string} [locale]
 * @return {string|null} `Y-m-d`, `H:i` or `Y-m-dTH:i`, or null.
 */
export function parseTyped(text, mode, format, locale = siteLocale()) {
  const input = String(text || '').trim();
  if (!input) {
    return null;
  }
  const iso = (parts) => {
    const date = parts.day !== undefined ? `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}` : '';
    const clock = parts.hours !== undefined ? toTime(parts.hours, parts.minutes ?? 0) : '';
    if (mode === 'time') {
      return clock || null;
    }
    if (mode === 'date') {
      return date || null;
    }
    return date ? joinDateTime(date, clock) : null;
  };

  const typed = parseWithFormat(input, format, locale);
  if (typed) {
    const value = iso(typed);
    if (value) {
      return value;
    }
  }

  if (mode === 'time') {
    const parts = parseTimeShape(input);
    return parts ? toTime(parts.hours, parts.minutes) : null;
  }
  if (mode === 'date') {
    const parts = parseDateShape(input);
    return parts ? iso(parts) : null;
  }
  // Date and time: a date, then a time after a space, a comma or a "T".
  const split = /^(.*?\d)(?:\s*[,T]\s*|\s+)((?:\d{1,2}(?:[:.]\d{2})?)\s*(?:[ap]\.?m\.?)?)$/i.exec(input);
  if (split) {
    const dateParts = parseDateShape(split[1]) || parseWithFormat(split[1], splitFormat(format).date, locale);
    const timePart = parseTimeShape(split[2]);
    if (dateParts && dateParts.day !== undefined && timePart) {
      return iso({ ...dateParts, ...timePart });
    }
  }
  const dateOnly = parseDateShape(input) || parseWithFormat(input, splitFormat(format).date, locale);
  return dateOnly && dateOnly.day !== undefined ? iso(dateOnly) : null;
}

// ── Limits ───────────────────────────────────────────────────────────────

/**
 * An earliest or latest date as an ISO day: an ISO date as it is, or a
 * relative expression ("today", "tomorrow", "+7 days", "today +1 month")
 * counted from `today`. Anything else is no limit (''). The server reads the
 * same expressions with strtotime in the site time zone.
 *
 * @param {string} value
 * @param {Date}   [today]
 * @return {string}
 */
export function resolveDateLimit(value, today = new Date()) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) {
    return '';
  }
  if (isIsoDate(text)) {
    return parseIsoDate(text) ? text : '';
  }
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const words = text.replace(/\s+/g, ' ');
  let rest = words;
  if (/^(today|now)\b/.test(rest)) {
    rest = rest.replace(/^(today|now)\s*/, '');
  } else if (/^tomorrow\b/.test(rest)) {
    date.setDate(date.getDate() + 1);
    rest = rest.replace(/^tomorrow\s*/, '');
  } else if (/^yesterday\b/.test(rest)) {
    date.setDate(date.getDate() - 1);
    rest = rest.replace(/^yesterday\s*/, '');
  }
  const step = /^([+-]?\s*\d+)\s*(day|week|month|year)s?\s*(ago)?\s*/;
  while (rest) {
    const match = step.exec(rest);
    if (!match) {
      return '';
    }
    let amount = Number(match[1].replace(/\s+/g, ''));
    if (match[3]) {
      amount = -Math.abs(amount);
    }
    if (match[2] === 'day') {
      date.setDate(date.getDate() + amount);
    } else if (match[2] === 'week') {
      date.setDate(date.getDate() + amount * 7);
    } else if (match[2] === 'month') {
      date.setMonth(date.getMonth() + amount);
    } else {
      date.setFullYear(date.getFullYear() + amount);
    }
    rest = rest.slice(match[0].length);
  }
  return toIsoDate(date);
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
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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
