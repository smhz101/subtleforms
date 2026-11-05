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
