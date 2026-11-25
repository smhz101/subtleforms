import { __, sprintf } from '@wordpress/i18n';
import { CHARACTER_RULES, minStrengthOf, meetsStrength } from './passwordStrength';

/** The word for a strength level. */
export function strengthName(level) {
  if (level === 'fair') return __('Fair', 'subtleforms');
  if (level === 'good') return __('Good', 'subtleforms');
  if (level === 'strong') return __('Strong', 'subtleforms');
  return __('Weak', 'subtleforms');
}

function label(id) {
  if (id === 'uppercase') return __('An uppercase letter', 'subtleforms');
  if (id === 'lowercase') return __('A lowercase letter', 'subtleforms');
  if (id === 'number') return __('A number', 'subtleforms');
  return __('A symbol', 'subtleforms');
}

/** The active rules, in display order, as { id, label }. */
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
    });
  }
  CHARACTER_RULES.forEach((r) => {
    if (config[r.flag] === true) rules.push({ id: r.id, label: label(r.id) });
  });
  const min = minStrengthOf(config);
  if (min !== 'any') {
    rules.push({
      id: 'strength',
      label:
        min === 'strong'
          ? __('Strength: Strong', 'subtleforms')
          : sprintf(
              /* translators: %s: strength level such as Good */
              __('Strength: %s or better', 'subtleforms'),
              strengthName(min)
            ),
    });
  }
  return rules;
}

/** Whether one rule from passwordRules() is met. */
export function isRuleMet(rule, value, config = {}) {
  const text = String(value || '');
  if (rule.id === 'length') return Array.from(text).length >= (Number(config.minLength) || 0);
  if (rule.id === 'strength') return meetsStrength(text, config);
  return CHARACTER_RULES.find((r) => r.id === rule.id).test(text);
}
