/**
 * Input mask engine (2.8.0). No dependency.
 *
 * A mask is a pattern where 9 is a digit, A is a letter and * is a letter or
 * digit. Any other character is a literal that is typed for the visitor.
 * Literals are added only when the next character arrives, so the visitor
 * can always delete back to an empty field.
 *
 * The presets below are mirrored by SubtleForms\Fields\InputMask (PHP), which
 * checks the same patterns on the server. A unit test keeps the two in step.
 */

import { PHONE_MAX_DIGITS, sanitizePhone, phoneDigits } from './phoneFormat';

export { PHONE_MAX_DIGITS, sanitizePhone, phoneDigits };

/* PRESETS_START */
export const PRESETS = {
  phone: { patterns: [], kind: 'phone', example: '+1 555 010 1234' },
  date_dmy: { patterns: ['99/99/9999'], kind: 'date', order: 'dmy', example: 'DD/MM/YYYY' },
  date_mdy: { patterns: ['99/99/9999'], kind: 'date', order: 'mdy', example: 'MM/DD/YYYY' },
  date_ymd: { patterns: ['9999-99-99'], kind: 'date', order: 'ymd', example: 'YYYY-MM-DD' },
  time_24: { patterns: ['99:99'], kind: 'time', example: 'HH:MM' },
  zip_us: { patterns: ['99999', '99999-9999'], kind: 'zip', example: '12345' },
  custom: { patterns: [], kind: 'custom', example: '' },
};
/* PRESETS_END */

/** Longest pattern accepted for a custom mask. */
export const MAX_PATTERN_LENGTH = 64;

const TOKENS = ['9', 'A', '*'];

const LETTER = /\p{L}/u;
const LETTER_OR_DIGIT = /[\p{L}0-9]/u;
const DIGIT = /[0-9]/;

function tokenMatches(token, ch) {
  if (token === '9') return DIGIT.test(ch);
  if (token === 'A') return LETTER.test(ch);
  return LETTER_OR_DIGIT.test(ch);
}

/**
 * Split a pattern into slots: { token } or { literal }.
 *
 * @param {string} pattern Mask pattern.
 * @return {Array<{token?: string, literal?: string}>} Slots.
 */
export function parsePattern(pattern) {
  return Array.from(String(pattern || '').slice(0, MAX_PATTERN_LENGTH)).map((ch) =>
    TOKENS.includes(ch) ? { token: ch } : { literal: ch }
  );
}

/** Number of characters the visitor types for a pattern. */
export function tokenCount(pattern) {
  return parsePattern(pattern).filter((slot) => slot.token).length;
}

/**
 * Whether the visitor only types digits for these patterns.
 *
 * @param {string[]} patterns Patterns.
 * @return {boolean} True when no slot takes a letter.
 */
export function isDigitsOnly(patterns) {
  return (
    patterns.length > 0 &&
    patterns.every((pattern) => parsePattern(pattern).every((slot) => slot.literal !== undefined || slot.token === '9'))
  );
}

/**
 * Run text through a pattern. Characters that do not fit are dropped,
 * literals are added in front of the next character that fits, and text
 * past the end of the pattern is cut off.
 *
 * @param {string} input   Text typed, pasted or autofilled.
 * @param {string} pattern Mask pattern.
 * @return {{value: string, raw: string}} Formatted text and the typed characters without literals.
 */
export function formatMask(input, pattern) {
  const slots = parsePattern(pattern);
  let value = '';
  let raw = '';
  let pending = '';
  let index = 0;
  for (const ch of Array.from(String(input ?? ''))) {
    if (index >= slots.length) {
      break;
    }
    let used = false;
    while (!used && index < slots.length) {
      const slot = slots[index];
      if (slot.literal !== undefined) {
        pending += slot.literal;
        index += 1;
        used = ch === slot.literal;
      } else {
        if (tokenMatches(slot.token, ch)) {
          value += pending + ch;
          raw += ch;
          pending = '';
          index += 1;
        }
        // A character that does not fit is dropped.
        used = true;
      }
    }
  }
  return { value, raw };
}

/**
 * Format what an input holds after an edit, and where the caret goes.
 * The caret stays after the same number of typed characters, so deleting a
 * literal moves the caret back over it and typing before a literal skips it.
 *
 * @param {string} input   Input value after the edit.
 * @param {number} caret   Caret position in `input`.
 * @param {string} pattern Mask pattern.
 * @return {{value: string, raw: string, caret: number}} Result.
 */
export function applyMask(input, caret, pattern) {
  const text = String(input ?? '');
  const before = Array.from(text).slice(0, Math.max(0, caret)).join('');
  const head = formatMask(before, pattern);
  const full = formatMask(text, pattern);
  return { value: full.value, raw: full.raw, caret: Math.min(head.value.length, full.value.length) };
}

function daysIn(month, year) {
  if (month === 2) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Whether typed characters make a real calendar day.
 *
 * @param {string} raw   Eight digits.
 * @param {string} order dmy, mdy or ymd.
 * @return {boolean} True for a day that exists.
 */
export function isRealDate(raw, order) {
  if (!/^\d{8}$/.test(raw)) return false;
  let day;
  let month;
  let year;
  if (order === 'ymd') {
    year = Number(raw.slice(0, 4));
    month = Number(raw.slice(4, 6));
    day = Number(raw.slice(6, 8));
  } else if (order === 'mdy') {
    month = Number(raw.slice(0, 2));
    day = Number(raw.slice(2, 4));
    year = Number(raw.slice(4, 8));
  } else {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(2, 4));
    year = Number(raw.slice(4, 8));
  }
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(month, year);
}

/** Whether four digits make a 24-hour time. */
export function isRealTime(raw) {
  return /^([01]\d|2[0-3])[0-5]\d$/.test(raw);
}

/**
 * The mask a field asks for, or null.
 *
 * @param {Object} config Field settings (fieldConfig(field)).
 * @return {null|Object} { key, kind, patterns, example, order, store, digitsOnly, inputMode, pattern }
 */
export function resolveMask(config) {
  const key = config && typeof config.inputMask === 'string' ? config.inputMask : '';
  const preset = PRESETS[key];
  if (!preset) {
    return null;
  }
  let patterns = preset.patterns;
  if (key === 'custom') {
    const custom = String(config.maskPattern ?? '').slice(0, MAX_PATTERN_LENGTH);
    if (tokenCount(custom) === 0) {
      return null;
    }
    patterns = [custom];
  }
  const digitsOnly = key === 'phone' ? true : isDigitsOnly(patterns);
  const canStripLiterals = preset.kind !== 'date' && preset.kind !== 'time';
  const store = config.maskStore === 'digits' && canStripLiterals ? 'digits' : 'typed';
  // The pattern the visitor types into: the longest one.
  const pattern = patterns.length ? patterns[patterns.length - 1] : '';
  return {
    key,
    kind: preset.kind,
    order: preset.order || '',
    patterns,
    pattern,
    example: key === 'custom' ? pattern : preset.example,
    store,
    digitsOnly,
    inputMode: key === 'phone' ? 'tel' : digitsOnly ? 'numeric' : 'text',
  };
}

/**
 * The value to keep in the form for what the input shows.
 *
 * @param {Object} mask  Result of resolveMask().
 * @param {string} shown Text in the input.
 * @return {string} Value to store.
 */
export function storedValue(mask, shown) {
  if (mask.kind === 'phone') {
    return mask.store === 'digits' ? phoneDigits(shown) : shown;
  }
  return mask.store === 'digits' ? formatMask(shown, mask.pattern).raw : shown;
}

/**
 * The text an input shows for a stored value.
 *
 * @param {Object} mask   Result of resolveMask().
 * @param {string} stored Stored value.
 * @return {string} Text to show.
 */
export function shownValue(mask, stored) {
  const text = String(stored ?? '');
  if (mask.kind === 'phone') {
    return sanitizePhone(text);
  }
  return formatMask(text, mask.pattern).value;
}

/**
 * Format a typed value for a mask: returns the text and the caret.
 *
 * @param {Object} mask  Result of resolveMask().
 * @param {string} input Input value after the edit.
 * @param {number} caret Caret position.
 * @return {{value: string, caret: number}} Result.
 */
export function editValue(mask, input, caret) {
  if (mask.kind === 'phone') {
    const head = sanitizePhone(String(input ?? '').slice(0, caret));
    const value = sanitizePhone(input);
    return { value, caret: Math.min(head.length, value.length) };
  }
  const { value, caret: next } = applyMask(input, caret, mask.pattern);
  return { value, caret: next };
}

/**
 * Check a stored value against a mask.
 *
 * @param {Object} mask  Result of resolveMask().
 * @param {string} value Stored value.
 * @return {''|'format'|'date'} '' when the value is fine, otherwise what is wrong.
 */
export function maskProblem(mask, value) {
  const text = String(value ?? '');
  if (text === '') {
    return '';
  }
  if (mask.kind === 'phone') {
    const digits = text.replace(/\D/g, '').length;
    const clean = /^\+?[\d\s()-]+$/.test(text) && text.indexOf('+') <= 0;
    return clean && digits >= 4 && digits <= PHONE_MAX_DIGITS ? '' : 'format';
  }
  // The raw characters, whichever way the value is stored.
  const parsed = formatMask(text, mask.pattern);
  const shownAgain = mask.store === 'digits' ? parsed.raw === text : parsed.value === text;
  if (!shownAgain) {
    return 'format';
  }
  if (!mask.patterns.some((pattern) => tokenCount(pattern) === parsed.raw.length)) {
    return 'format';
  }
  if (mask.kind === 'date' && !isRealDate(parsed.raw, mask.order)) {
    return /^\d{8}$/.test(parsed.raw) ? 'date' : 'format';
  }
  if (mask.kind === 'time' && !isRealTime(parsed.raw)) {
    return 'format';
  }
  return '';
}

/**
 * Words for the format a mask expects, for the placeholder and the hint.
 * Custom patterns list the symbols they use.
 *
 * @param {Object} mask Result of resolveMask().
 * @return {{example: string, letters: boolean, digits: boolean, either: boolean}} Parts.
 */
export function maskSymbols(mask) {
  const slots = parsePattern(mask.pattern);
  return {
    example: mask.example,
    digits: slots.some((slot) => slot.token === '9'),
    letters: slots.some((slot) => slot.token === 'A'),
    either: slots.some((slot) => slot.token === '*'),
  };
}
