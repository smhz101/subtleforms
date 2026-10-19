import { __ } from '@wordpress/i18n';

/**
 * Which operators and values a logic rule should offer for a field (FB-20).
 */

const CHECK = ['equals', 'not_equals', 'empty', 'not_empty'];
const NUMBER = ['equals', 'not_equals', 'greater_than', 'less_than', 'empty', 'not_empty'];
const DATE = ['equals', 'not_equals', 'before', 'after', 'empty', 'not_empty'];
const CHOICE = ['equals', 'not_equals', 'contains', 'not_contains', 'empty', 'not_empty'];

const BY_TYPE = {
  checkbox: CHECK,
  consent: CHECK,
  toggle: CHECK,
  country: CHECK,
  number: NUMBER,
  range_slider: NUMBER,
  scale: NUMBER,
  net_promoter_score: NUMBER,
  date: DATE,
  time: DATE,
  datetime: DATE,
  dropdown: CHOICE,
  select: CHOICE,
  radio: CHOICE,
  multiple_choice: CHOICE,
  picture_choice: CHOICE,
};

export function logicOperatorsFor(type) {
  return BY_TYPE[type] || null;
}

export function logicValueChoices(field, countries = []) {
  if (!field || typeof field !== 'object') {
    return [];
  }
  if (field.type === 'checkbox' || field.type === 'consent') {
    return [
      { label: __('Checked', 'subtleforms'), value: 'true' },
      { label: __('Unchecked', 'subtleforms'), value: 'false' },
    ];
  }
  if (field.type === 'toggle') {
    return [
      { label: __('On', 'subtleforms'), value: String(field.onValue || 'yes') },
      { label: __('Off', 'subtleforms'), value: String(field.offValue || 'no') },
    ];
  }
  if (field.type === 'country' && Array.isArray(countries)) {
    return countries
      .map((country) => ({
        label: country.name || country.code || '',
        value: String(country.code || country.value || ''),
      }))
      .filter((country) => country.value);
  }
  if (!Array.isArray(field.options)) {
    return [];
  }
  return field.options
    .map((option) => (
      option && typeof option === 'object'
        ? { label: String(option.label ?? option.value ?? ''), value: String(option.value ?? option.label ?? '') }
        : { label: String(option), value: String(option) }
    ))
    .filter((option) => option.value !== '');
}

const YES = ['true', '1', 'yes', 'checked', 'on'];
const NO = ['false', '0', 'no', 'unchecked', 'off', ''];

export function sameCheckValue(actual, expected) {
  const a = actual === true ? 'true' : actual === false ? 'false' : String(actual ?? '').trim().toLowerCase();
  const e = String(expected ?? '').trim().toLowerCase();
  if (YES.includes(e) && YES.includes(a)) return true;
  if (NO.includes(e) && NO.includes(a)) return true;
  return a === e;
}
