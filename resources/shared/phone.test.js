import { flagEmoji, filterPhoneCountries, splitPhoneValue, joinPhoneValue, phoneCountries } from './phone';

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
});
