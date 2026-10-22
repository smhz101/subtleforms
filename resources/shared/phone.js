import { COUNTRIES } from './countries';
import { DIAL_CODES } from './phoneDial';

// Kept here too so existing imports keep working.
export { DIAL_CODES, looksInternational, isValidInternational } from './phoneDial';

/**
 * Flag emoji for an ISO 3166-1 alpha-2 code. No image assets.
 *
 * @param {string} code
 * @return {string}
 */
export function flagMark(code) {
  const letters = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
  return letters.slice(0, 2);
}

export function flagEmoji(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    return '';
  }
  return String.fromCodePoint(...[...cc].map((char) => 127397 + char.charCodeAt(0)));
}

/**
 * Countries that can be chosen as a phone prefix.
 *
 * @return {Array<{code: string, name: string, dial: string}>}
 */
export function phoneCountries() {
  return COUNTRIES
    .filter((country) => DIAL_CODES[country.code])
    .map((country) => ({
      code: country.code,
      name: country.name,
      dial: DIAL_CODES[country.code],
    }));
}

/**
 * @param {string} code
 * @return {{code: string, name: string, dial: string}|null}
 */
export function phoneCountry(code) {
  const wanted = String(code || '').toUpperCase();
  return phoneCountries().find((country) => country.code === wanted) || null;
}

/**
 * Search by country name, ISO code, or dial code.
 *
 * @param {string} query
 * @return {Array<{code: string, name: string, dial: string}>}
 */
export function filterPhoneCountries(query) {
  const q = String(query || '').trim().toLowerCase().replace(/^\+/, '');
  const all = phoneCountries();
  if (!q) {
    return all;
  }
  return all.filter((country) =>
    country.name.toLowerCase().includes(q) ||
    country.code.toLowerCase().includes(q) ||
    country.dial.includes(q)
  );
}

/**
 * Canadian area codes. US and Canada share +1, so the area code tells them
 * apart when a stored "+1 ..." number is read back (FLD2-07).
 */
const CANADA_AREA_CODES = new Set([
  '204', '226', '236', '249', '250', '257', '263', '289', '306', '343', '354',
  '365', '367', '368', '382', '387', '403', '416', '418', '428', '431', '437',
  '438', '450', '460', '468', '474', '506', '514', '519', '548', '579', '581',
  '584', '587', '604', '613', '639', '647', '672', '683', '705', '709', '742',
  '753', '778', '780', '782', '807', '819', '825', '867', '873', '879', '902',
  '905', '942',
]);

/**
 * The country a shared calling code means when nothing else says (+44 is the
 * United Kingdom, not Guernsey).
 */
const MAIN_COUNTRY = {
  1: 'US', 7: 'RU', 39: 'IT', 44: 'GB', 47: 'NO', 61: 'AU', 64: 'NZ', 212: 'MA',
  262: 'RE', 290: 'SH', 358: 'FI', 500: 'FK', 590: 'GP', 599: 'CW',
};

/** Calling codes whose national numbers keep their leading 0 (Italy, San Marino). */
const KEEPS_TRUNK_ZERO = new Set(['39', '378']);

/**
 * The national number without the trunk 0 that is dialled only inside the
 * country ("07700 900123" in the UK is +44 7700 900123).
 *
 * @param {{dial?: string}|null} country
 * @param {string} digits
 * @return {string}
 */
function dropTrunkZero(country, digits) {
  if (!country?.dial || KEEPS_TRUNK_ZERO.has(country.dial)) {
    return digits;
  }
  return digits.replace(/^0/, '');
}

/**
 * Split a stored phone string into the selected country and the national number.
 * The longest matching dial code wins, so +1 does not swallow +1242-style codes
 * that this list does not use; shared codes (+1) keep the saved country when
 * `preferredCode` matches that dial, and a Canadian area code reads as Canada.
 *
 * @param {string} value
 * @param {string} [preferredCode]
 * @return {{country: Object|null, national: string}}
 */
export function splitPhoneValue(value, preferredCode = 'US') {
  const countries = phoneCountries();
  const preferred = phoneCountry(preferredCode) || phoneCountry('US') || countries[0] || null;
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { country: preferred, national: '' };
  }

  const compact = raw.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (compact.startsWith('+')) {
    const numeric = compact.slice(1);
    const matches = countries
      .filter((country) => numeric.startsWith(country.dial))
      .sort((a, b) => b.dial.length - a.dial.length);
    const longest = matches[0]?.dial;
    let match =
      matches.find((country) => country.code === preferred?.code) ||
      matches.find((country) => country.dial === longest && MAIN_COUNTRY[longest] === country.code) ||
      matches[0];
    if (match && match.dial === '1') {
      const area = numeric.slice(1, 4);
      if (CANADA_AREA_CODES.has(area)) {
        match = phoneCountry('CA');
      } else if (match.code === 'CA') {
        match = phoneCountry('US');
      }
    }
    if (match) {
      return { country: match, national: dropTrunkZero(match, numeric.slice(match.dial.length)) };
    }
  }

  return { country: preferred, national: raw.replace(/[^\d]/g, '') };
}

/**
 * Value stored on the submission: dial code plus the digits the visitor
 * typed, without the trunk 0 (FLD2-07).
 *
 * @param {{dial?: string}|null} country
 * @param {string} national
 * @return {string}
 */
export function joinPhoneValue(country, national) {
  const digits = String(national || '').replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }
  if (!country?.dial) {
    return digits;
  }
  const local = dropTrunkZero(country, digits);
  return local ? `+${country.dial} ${local}` : '';
}

