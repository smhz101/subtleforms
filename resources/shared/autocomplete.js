/**
 * Autofill hints for text-like fields (2.10.0).
 *
 * The `autocomplete` attribute tells browsers and password managers what an
 * input asks for, so they can fill it in (WCAG 1.3.5, Identify Input
 * Purpose). A field can pick a token in the builder; with "Automatic" the
 * token is inferred from the field key, then the label.
 *
 * The token list mirrors CoreFields::autocompleteTokens() in src/Fields/CoreFields.php.
 */

import { __ } from '@wordpress/i18n';
import { fieldConfig } from './fieldConfig';

/**
 * Tokens a field may hold, in the order the builder lists them. '' means
 * Automatic.
 *
 * @return {Array<{value: string, label: string}>} Options.
 */
export function autocompleteOptions() {
  return [
    { value: '', label: __('Automatic', 'subtleforms') },
    { value: 'off', label: __('Off', 'subtleforms') },
    { value: 'name', label: __('Full name', 'subtleforms') },
    { value: 'given-name', label: __('First name', 'subtleforms') },
    { value: 'family-name', label: __('Last name', 'subtleforms') },
    { value: 'email', label: __('Email', 'subtleforms') },
    { value: 'tel', label: __('Phone', 'subtleforms') },
    { value: 'organization', label: __('Company', 'subtleforms') },
    { value: 'organization-title', label: __('Job title', 'subtleforms') },
    { value: 'street-address', label: __('Street address', 'subtleforms') },
    { value: 'address-line1', label: __('Address line 1', 'subtleforms') },
    { value: 'address-line2', label: __('Address line 2', 'subtleforms') },
    { value: 'address-level2', label: __('City', 'subtleforms') },
    { value: 'address-level1', label: __('State or region', 'subtleforms') },
    { value: 'postal-code', label: __('Postal code', 'subtleforms') },
    { value: 'country-name', label: __('Country', 'subtleforms') },
    { value: 'url', label: __('Website', 'subtleforms') },
    { value: 'bday', label: __('Birthday', 'subtleforms') },
  ];
}

/** Allow-list of tokens ('' is Automatic). */
export const AUTOCOMPLETE_TOKEN_LIST = [
  '',
  'off',
  'name',
  'given-name',
  'family-name',
  'email',
  'tel',
  'organization',
  'organization-title',
  'street-address',
  'address-line1',
  'address-line2',
  'address-level2',
  'address-level1',
  'postal-code',
  'country-name',
  'url',
  'bday',
];

/**
 * Phrases that name a token. The first rule that matches wins, so the
 * specific phrases ("first name") come before the general one ("name").
 */
const RULES = [
  ['given-name', ['first name', 'given name', 'forename']],
  ['family-name', ['last name', 'surname', 'family name']],
  ['organization-title', ['job title', 'position', 'role']],
  ['organization', ['company', 'organization', 'organisation', 'business']],
  ['address-level2', ['city', 'town']],
  ['postal-code', ['zip', 'postcode', 'postal code']],
  ['name', ['full name', 'your name', 'name']],
];

/**
 * Words of a key or label: lowercased, underscores and dashes count as spaces.
 *
 * @param {*} text Key or label.
 * @return {string[]} Words.
 */
function words(text) {
  if (typeof text !== 'string') {
    return [];
  }
  return text
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .split(/[^a-z0-9À-￿]+/)
    .filter(Boolean);
}

/**
 * Whether the phrase sits in the words as a whole run of words.
 *
 * @param {string[]} list   Words of the key or label.
 * @param {string}   phrase Phrase, words separated by a space.
 * @return {boolean} True when found.
 */
function hasPhrase(list, phrase) {
  const target = phrase.split(' ');
  for (let i = 0; i + target.length <= list.length; i++) {
    if (target.every((word, offset) => list[i + offset] === word)) {
      return true;
    }
  }
  return false;
}

/**
 * The token a Text field most likely asks for, from its key and then its
 * label. Whole words only: a key `username` does not match `name`.
 *
 * @param {Object} field Field node (flat or with a config).
 * @return {string} A token, or '' when nothing matches (no attribute).
 */
export function inferAutocomplete(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  const flat = fieldConfig(field);
  const type = field.type || flat.type;
  if (type && type !== 'text') {
    return '';
  }
  const sources = [flat.key || field.key, flat.label || field.label];
  for (const source of sources) {
    const list = words(source);
    if (list.length) {
      const hit = RULES.find(([, phrases]) => phrases.some((p) => hasPhrase(list, p)));
      if (hit) {
        return hit[0];
      }
    }
  }
  return '';
}
