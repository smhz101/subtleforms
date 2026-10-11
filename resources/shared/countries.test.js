import fs from 'fs';
import path from 'path';
import { COUNTRIES, orderedCountries } from './countries';

describe('one country list (2.2.1 bug 3)', () => {
  test('the browser list has the same codes as the server list', () => {
    const php = fs.readFileSync(path.join(__dirname, '../../src/Fields/CountryList.php'), 'utf8');
    const phpCodes = Array.from(php.matchAll(/'([A-Z]{2})'\s*=>/g)).map((m) => m[1]);
    const jsCodes = COUNTRIES.map((c) => c.code);
    expect(phpCodes.length).toBeGreaterThan(240);
    expect(new Set(jsCodes)).toEqual(new Set(phpCodes));
  });

  test('codes are unique', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('preferred countries come first, without duplicates', () => {
    const list = orderedCountries(['pk', 'GB']);
    expect(list[0].code).toBe('PK');
    expect(list[1].code).toBe('GB');
    expect(list.filter((c) => c.code === 'PK')).toHaveLength(1);
    expect(list).toHaveLength(COUNTRIES.length);
  });
});
