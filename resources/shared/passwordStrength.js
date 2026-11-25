import { __ } from '@wordpress/i18n';

/**
 * The small part of the password rules that form validation needs. The meter
 * and checklist words live in passwordRules.js, which downloads on its own.
 */
export const LEVELS = ['weak', 'fair', 'good', 'strong'];

/**
 * Strength of a password, from five one-point checks: 8+ characters, 12+
 * characters, lower and upper case, a digit, a symbol (anything that is not
 * A-Z, a-z, 0-9 or whitespace). src/Engine/FieldValidator.php mirrors this
 * exactly.
 *
 * @param {string} value Password.
 * @return {'none'|'weak'|'fair'|'good'|'strong'}
 */
export function passwordStrength(value) {
  const text = String(value || '');
  if (!text) {
    return 'none';
  }
  // Code points, as the server counts with mb_strlen.
  const length = Array.from(text).length;
  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  if (/\d/.test(text)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(text)) score += 1;
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}

export const CHARACTER_RULES = [
  { id: 'uppercase', flag: 'requireUppercase', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', flag: 'requireLowercase', test: (v) => /[a-z]/.test(v) },
  { id: 'number', flag: 'requireNumber', test: (v) => /\d/.test(v) },
  { id: 'symbol', flag: 'requireSymbol', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export function minStrengthOf(config) {
  return LEVELS.includes(config?.minStrength) ? config.minStrength : 'any';
}

/** True when the field asks for any character rule or a minimum strength. */
export function hasPasswordRules(config = {}) {
  return CHARACTER_RULES.some((r) => config[r.flag] === true) || minStrengthOf(config) !== 'any';
}

/** True when the password is at least the wanted strength. */
export function meetsStrength(value, config = {}) {
  const min = minStrengthOf(config);
  return min === 'any' || LEVELS.indexOf(passwordStrength(value)) >= LEVELS.indexOf(min);
}

function phrase(id) {
  if (id === 'uppercase') return __('an uppercase letter', 'subtleforms');
  if (id === 'lowercase') return __('a lowercase letter', 'subtleforms');
  if (id === 'number') return __('a number', 'subtleforms');
  return __('a symbol', 'subtleforms');
}

/** The character rules (uppercase, lowercase, number, symbol) the value breaks. */
export function unmetRules(value, config = {}) {
  const text = String(value || '');
  return CHARACTER_RULES.filter((r) => config[r.flag] === true && !r.test(text)).map((r) => ({
    id: r.id,
    phrase: phrase(r.id),
  }));
}
