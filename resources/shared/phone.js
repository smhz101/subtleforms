import { COUNTRIES } from './countries';

/**
 * Dial codes for the phone country picker. Territories without a
 * public calling code are omitted.
 */
export const DIAL_CODES = {
  AF: '93',
  AX: '358',
  AL: '355',
  DZ: '213',
  AS: '1',
  AD: '376',
  AO: '244',
  AI: '1',
  AG: '1',
  AR: '54',
  AM: '374',
  AW: '297',
  AU: '61',
  AT: '43',
  AZ: '994',
  BS: '1',
  BH: '973',
  BD: '880',
  BB: '1',
  BY: '375',
  BE: '32',
  BZ: '501',
  BJ: '229',
  BM: '1',
  BT: '975',
  BO: '591',
  BQ: '599',
  BA: '387',
  BW: '267',
  BR: '55',
  IO: '246',
  BN: '673',
  BG: '359',
  BF: '226',
  BI: '257',
  CV: '238',
  KH: '855',
  CM: '237',
  CA: '1',
  KY: '1',
  CF: '236',
  TD: '235',
  CL: '56',
  CN: '86',
  CX: '61',
  CC: '61',
  CO: '57',
  KM: '269',
  CG: '242',
  CD: '243',
  CK: '682',
  CR: '506',
  CI: '225',
  HR: '385',
  CU: '53',
  CW: '599',
  CY: '357',
  CZ: '420',
  DK: '45',
  DJ: '253',
  DM: '1',
  DO: '1',
  EC: '593',
  EG: '20',
  SV: '503',
  GQ: '240',
  ER: '291',
  EE: '372',
  SZ: '268',
  ET: '251',
  FK: '500',
  FO: '298',
  FJ: '679',
  FI: '358',
  FR: '33',
  GF: '594',
  PF: '689',
  GA: '241',
  GM: '220',
  GE: '995',
  DE: '49',
  GH: '233',
  GI: '350',
  GR: '30',
  GL: '299',
  GD: '1',
  GP: '590',
  GU: '1',
  GT: '502',
  GG: '44',
  GN: '224',
  GW: '245',
  GY: '592',
  HT: '509',
  VA: '39',
  HN: '504',
  HK: '852',
  HU: '36',
  IS: '354',
  IN: '91',
  ID: '62',
  IR: '98',
  IQ: '964',
  IE: '353',
  IM: '44',
  IL: '972',
  IT: '39',
  JM: '1',
  JP: '81',
  JE: '44',
  JO: '962',
  KZ: '7',
  KE: '254',
  KI: '686',
  KP: '850',
  KR: '82',
  KW: '965',
  KG: '996',
  LA: '856',
  LV: '371',
  LB: '961',
  LS: '266',
  LR: '231',
  LY: '218',
  LI: '423',
  LT: '370',
  LU: '352',
  MO: '853',
  MG: '261',
  MW: '265',
  MY: '60',
  MV: '960',
  ML: '223',
  MT: '356',
  MH: '692',
  MQ: '596',
  MR: '222',
  MU: '230',
  YT: '262',
  MX: '52',
  FM: '691',
  MD: '373',
  MC: '377',
  MN: '976',
  ME: '382',
  MS: '1',
  MA: '212',
  MZ: '258',
  MM: '95',
  NA: '264',
  NR: '674',
  NP: '977',
  NL: '31',
  NC: '687',
  NZ: '64',
  NI: '505',
  NE: '227',
  NG: '234',
  NU: '683',
  NF: '672',
  MK: '389',
  MP: '1',
  NO: '47',
  OM: '968',
  PK: '92',
  PW: '680',
  PS: '970',
  PA: '507',
  PG: '675',
  PY: '595',
  PE: '51',
  PH: '63',
  PN: '64',
  PL: '48',
  PT: '351',
  PR: '1',
  QA: '974',
  RE: '262',
  RO: '40',
  RU: '7',
  RW: '250',
  BL: '590',
  SH: '290',
  KN: '1',
  LC: '1',
  MF: '590',
  PM: '508',
  VC: '1',
  WS: '685',
  SM: '378',
  ST: '239',
  SA: '966',
  SN: '221',
  RS: '381',
  SC: '248',
  SL: '232',
  SG: '65',
  SX: '1',
  SK: '421',
  SI: '386',
  SB: '677',
  SO: '252',
  ZA: '27',
  GS: '500',
  SS: '211',
  ES: '34',
  LK: '94',
  SD: '249',
  SR: '597',
  SJ: '47',
  SE: '46',
  CH: '41',
  SY: '963',
  TW: '886',
  TJ: '992',
  TZ: '255',
  TH: '66',
  TL: '670',
  TG: '228',
  TK: '690',
  TO: '676',
  TT: '1',
  TN: '216',
  TR: '90',
  TM: '993',
  TC: '1',
  TV: '688',
  UG: '256',
  UA: '380',
  AE: '971',
  GB: '44',
  US: '1',
  UY: '598',
  UZ: '998',
  VU: '678',
  VE: '58',
  VN: '84',
  VG: '1',
  VI: '1',
  WF: '681',
  EH: '212',
  YE: '967',
  ZM: '260',
  ZW: '263',
};

/**
 * Flag emoji for an ISO 3166-1 alpha-2 code. No image assets.
 *
 * @param {string} code
 * @return {string}
 */
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

/**
 * Whether what the visitor typed or pasted is a full international number
 * ("+44 20 7946 0958" or "0044 ..."), so the country should follow it.
 *
 * @param {string} text
 * @return {boolean}
 */
export function looksInternational(text) {
  return /^\s*(\+|00)/.test(String(text ?? ''));
}

/**
 * Whether an international phone answer is a real number: a known calling
 * code, 10 digits after +1, otherwise 4 or more and at most 15 digits in all
 * (E.164). The server applies the same rule (FieldValidator::validatePhone).
 *
 * @param {string} value
 * @return {boolean}
 */
export function isValidInternational(value) {
  const raw = String(value ?? '').trim();
  if (!raw.startsWith('+')) {
    return true;
  }
  const digits = raw.replace(/\D/g, '');
  const dial = Object.values(DIAL_CODES)
    .filter((code) => digits.startsWith(code))
    .sort((a, b) => b.length - a.length)[0];
  if (!dial) {
    return false;
  }
  const national = digits.length - dial.length;
  return dial === '1' ? national === 10 : national >= 4 && digits.length <= 15;
}
