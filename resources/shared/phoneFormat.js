/**
 * US phone formatting (FB-08). Ten digits become (555) 010-1234.
 *
 * @param {string} value Raw input.
 * @return {string}
 */
export function formatUsPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format a US phone edit and place the caret by digit count, so separators
 * added or removed by the formatting do not move it. Deleting only a
 * separator (backspace over ")") removes the digit before it.
 *
 * @param {string} prev Value shown before the edit.
 * @param {string} typed Value in the input after the edit.
 * @param {number} caret Caret position in `typed`.
 * @return {{value: string, caret: number}}
 */
export function editUsPhone(prev, typed, caret) {
  const text = String(typed ?? '');
  const at = Math.min(caret ?? text.length, text.length);
  let before = text.slice(0, at).replace(/\D/g, '').length;
  let digits = text.replace(/\D/g, '');
  if (
    text.length < String(prev ?? '').length &&
    digits.length === String(prev ?? '').replace(/\D/g, '').length &&
    before > 0
  ) {
    digits = digits.slice(0, before - 1) + digits.slice(before);
    before -= 1;
  }
  const value = formatUsPhone(digits);
  if (at >= text.length) {
    return { value, caret: value.length };
  }
  let seen = 0;
  let pos = 0;
  while (pos < value.length && seen < before) {
    if (/\d/.test(value[pos])) seen += 1;
    pos += 1;
  }
  return { value, caret: pos };
}

export function isCompleteUsPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length === 10;
}

/** Maximum digits in a phone number (E.164). */
export const PHONE_MAX_DIGITS = 15;

/**
 * Keep phone characters only: digits, spaces, dashes, brackets and a
 * leading plus, up to 15 digits.
 *
 * @param {string} input Text.
 * @return {string} Cleaned text.
 */
export function sanitizePhone(input) {
  let out = '';
  let digits = 0;
  Array.from(String(input ?? '')).forEach((ch) => {
    if (/\d/.test(ch)) {
      if (digits < PHONE_MAX_DIGITS) {
        out += ch;
        digits += 1;
      }
    } else if (ch === '+' && out.trim() === '') {
      out += ch;
    } else if (/[ ()-]/.test(ch)) {
      out += ch;
    }
  });
  return out.replace(/^\s+/, '');
}

/** Phone number without the formatting characters ("+" is kept in front). */
export function phoneDigits(input) {
  const text = String(input ?? '').trim();
  return (text.startsWith('+') ? '+' : '') + text.replace(/\D/g, '');
}
