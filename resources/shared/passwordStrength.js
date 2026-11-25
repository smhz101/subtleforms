import { __, sprintf } from '@wordpress/i18n';

const LEVELS = ['weak', 'fair', 'good', 'strong'];

/**
 * Strength of a password, from five one-point checks: 8+ characters, 12+
 * characters, lower and upper case, a digit, a symbol (anything that is not
 * A-Z, a-z or 0-9, a space included). src/Engine/FieldValidator.php mirrors
 * this exactly.
 *
 * @param {string} value Password.
 * @return {'none'|'weak'|'fair'|'good'|'strong'}
 */
export function passwordStrength(value) {
  const text = String(value || '');
  if (!text) {
    return 'none';
  }
  let score = 0;
  if (text.length >= 8) score += 1;
  if (text.length >= 12) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  if (/\d/.test(text)) score += 1;
  if (/[^A-Za-z0-9]/.test(text)) score += 1;
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}

const CHARACTER_RULES = [
  { id: 'uppercase', flag: 'requireUppercase', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', flag: 'requireLowercase', test: (v) => /[a-z]/.test(v) },
  { id: 'number', flag: 'requireNumber', test: (v) => /\d/.test(v) },
  { id: 'symbol', flag: 'requireSymbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function strengthName(level) {
  if (level === 'fair') return __('Fair', 'subtleforms');
  if (level === 'good') return __('Good', 'subtleforms');
  if (level === 'strong') return __('Strong', 'subtleforms');
  return __('Weak', 'subtleforms');
}

function phrase(id) {
  if (id === 'uppercase') return __('an uppercase letter', 'subtleforms');
  if (id === 'lowercase') return __('a lowercase letter', 'subtleforms');
  if (id === 'number') return __('a number', 'subtleforms');
  return __('a symbol', 'subtleforms');
}

function label(id) {
  if (id === 'uppercase') return __('An uppercase letter', 'subtleforms');
  if (id === 'lowercase') return __('A lowercase letter', 'subtleforms');
  if (id === 'number') return __('A number', 'subtleforms');
  return __('A symbol', 'subtleforms');
}

function minStrengthOf(config) {
  return LEVELS.includes(config?.minStrength) ? config.minStrength : 'any';
}

/** True when the field asks for any character rule or a minimum strength. */
export function hasPasswordRules(config = {}) {
  return CHARACTER_RULES.some((r) => config[r.flag] === true) || minStrengthOf(config) !== 'any';
}

/**
 * The active rules, in display order, as { id, label, phrase }.
 * The length rule shows only when minLength is set.
 */
export function passwordRules(config = {}) {
  const rules = [];
  const minLength = Number(config.minLength) || 0;
  if (minLength > 0) {
    rules.push({
      id: 'length',
      label: sprintf(
        /* translators: %d: minimum number of characters */
        __('At least %d characters', 'subtleforms'),
        minLength
      ),
      phrase: '',
    });
  }
  CHARACTER_RULES.forEach((r) => {
    if (config[r.flag] === true) rules.push({ id: r.id, label: label(r.id), phrase: phrase(r.id) });
  });
  const min = minStrengthOf(config);
  if (min !== 'any') {
    rules.push({
      id: 'strength',
      label: sprintf(
        /* translators: %s: strength level such as Good */
        __('Strength: %s or better', 'subtleforms'),
        strengthName(min)
      ),
      phrase: '',
    });
  }
  return rules;
}

/** True when the password is at least the wanted strength. */
export function meetsStrength(value, config = {}) {
  const min = minStrengthOf(config);
  return min === 'any' || LEVELS.indexOf(passwordStrength(value)) >= LEVELS.indexOf(min);
}

/** Whether one rule from passwordRules() is met. */
export function isRuleMet(rule, value, config = {}) {
  const text = String(value || '');
  if (rule.id === 'length') return text.length >= (Number(config.minLength) || 0);
  if (rule.id === 'strength') return meetsStrength(text, config);
  return CHARACTER_RULES.find((r) => r.id === rule.id).test(text);
}

/** The character rules (uppercase, lowercase, number, symbol) the value breaks. */
export function unmetRules(value, config = {}) {
  return passwordRules(config).filter(
    (rule) => rule.id !== 'length' && rule.id !== 'strength' && !isRuleMet(rule, value, config)
  );
}

export { strengthName };
