import fs from 'fs';
import path from 'path';
import {
  DIAL_CODES,
  flagEmoji,
  filterPhoneCountries,
  isValidInternational,
  joinPhoneValue,
  looksInternational,
  phoneCountries,
  phoneCountry,
  splitPhoneValue,
} from './phone';

describe('phone countries', () => {
  test('builds a flag from the country code', () => {
    expect(flagEmoji('US')).toBe('🇺🇸');
    expect(flagEmoji('')).toBe('');
  });

  test('search matches name, code, and dial code', () => {
    expect(filterPhoneCountries('united kingdom').map((c) => c.code)).toContain('GB');
    expect(filterPhoneCountries('44').some((c) => c.code === 'GB')).toBe(true);
    expect(filterPhoneCountries('zz')).toHaveLength(0);
  });

  test('joins and splits a country code and national number', () => {
    const us = phoneCountries().find((c) => c.code === 'US');
    expect(joinPhoneValue(us, '(415) 555-0100')).toBe('+1 4155550100');
    const parts = splitPhoneValue('+44 2079460958', 'GB');
    expect(parts.country.code).toBe('GB');
    expect(parts.national).toBe('2079460958');
  });

  test('an empty value keeps the default country and no number', () => {
    const parts = splitPhoneValue('', 'JP');
    expect(parts.country.code).toBe('JP');
    expect(parts.national).toBe('');
    expect(joinPhoneValue(parts.country, '')).toBe('');
  });

  // FLD2-07
  test('the trunk 0 is dropped, except where it is part of the number', () => {
    expect(joinPhoneValue(phoneCountry('GB'), '07700 900123')).toBe('+44 7700900123');
    expect(joinPhoneValue(phoneCountry('IT'), '06 1234 5678')).toBe('+39 0612345678');
  });

  test('a pasted international number carries its own country', () => {
    expect(looksInternational('+44 20 7946 0958')).toBe(true);
    expect(looksInternational('0044 20 7946 0958')).toBe(true);
    expect(looksInternational('0300 1234567')).toBe(false);
    const parts = splitPhoneValue('+44 20 7946 0958', 'PK');
    expect(parts.country.code).toBe('GB');
    expect(joinPhoneValue(parts.country, parts.national)).toBe('+44 2079460958');
  });

  test('a Canadian area code reads as Canada, others as the US', () => {
    expect(splitPhoneValue('+1 4165550100', 'US').country.code).toBe('CA');
    expect(splitPhoneValue('+1 4155550100', 'CA').country.code).toBe('US');
  });

  test('international numbers need a known code and a real length', () => {
    expect(isValidInternational('+1 5')).toBe(false);
    expect(isValidInternational('+999 123')).toBe(false);
    expect(isValidInternational('+1 4155550100')).toBe(true);
    expect(isValidInternational('5550100')).toBe(true);
  });

  test('the server has the same calling codes', () => {
    const php = fs.readFileSync(path.join(__dirname, '../../src/Fields/CountryList.php'), 'utf8');
    const body = php.slice(php.indexOf('function dialCodes'));
    const phpCodes = Object.fromEntries(
      Array.from(body.matchAll(/'([A-Z]{2})' => '(\d+)'/g)).map((m) => [m[1], m[2]])
    );
    expect(phpCodes).toEqual(DIAL_CODES);
  });
});
