/**
 * Name and Address parts follow the builder's sub-field settings (FB-01,
 * FB-02, FB-10).
 */
import { compositeParts, missingParts, partSettingsMap } from './compositeParts';

const parts = (type, config) => compositeParts(type, config).map((p) => p.part);

describe('compositeParts', () => {
  it('draws first and last name by default', () => {
    expect(parts('name_group', {})).toEqual(['first_name', 'last_name']);
  });

  it('draws middle name and suffix when switched on, with their labels', () => {
    const config = {
      fields: {
        first_name: { enabled: true, label: 'Given name' },
        middle_name: { enabled: true, label: 'Middle' },
        suffix: { enabled: true, label: 'Suffix' },
      },
    };
    expect(parts('name_group', config)).toEqual(['first_name', 'middle_name', 'last_name', 'suffix']);
    expect(compositeParts('name_group', config)[0].label).toBe('Given name');
  });

  it('leaves out address parts switched off and adds line 2 when on', () => {
    const config = { fields: { street2: { enabled: true }, country: { enabled: false }, state: { enabled: false } } };
    expect(parts('address_group', config)).toEqual(['street', 'street2', 'city', 'postal']);
  });

  it('reads the older enable_* flags', () => {
    expect(parts('address_group', { enable_street2: true, enable_country: false })).toEqual([
      'street',
      'street2',
      'city',
      'state',
      'postal',
    ]);
  });

  it('repairs a list saved without keys', () => {
    const map = partSettingsMap('name_group', [
      { label: 'First Name', enabled: true },
      { label: 'Last Name', enabled: true },
      { label: 'Middle', enabled: true },
      { label: 'Suffix', enabled: true },
    ]);
    expect(map.middle_name.label).toBe('Middle');
    expect(parts('name_group', { fields: map })).toEqual(['first_name', 'middle_name', 'last_name', 'suffix']);
  });
});

describe('missingParts', () => {
  it('demands every drawn part that is not optional', () => {
    expect(missingParts('name_group', {}, { first_name: 'Ada' })).toEqual(['last_name']);
    expect(missingParts('address_group', { fields: { street2: { enabled: true } } }, { street_address: '1', city: 'X', state: 'Y', postal_code: '1', country: 'PK' })).toEqual([]);
  });

  it('does not demand a part that is switched off', () => {
    const config = { fields: { country: { enabled: false } } };
    expect(missingParts('address_group', config, { street_address: '1', city: 'X', state: 'Y', postal_code: '1' })).toEqual([]);
  });
});

describe('parts added by an add-on (registerCompositeParts)', () => {
  // eslint-disable-next-line global-require
  const { registerCompositeParts } = require('./extend');
  const { compositeDataParts, compositeKnownKeys, compositeSubfields } = require('./compositeParts');

  afterEach(() => {
    window.__subtleformsExtend.compositeParts = {};
  });

  it('appends parts after the built-in ones and draws them', () => {
    registerCompositeParts('address_group', [{ part: 'apartment', value: 'apartment', label: 'Apartment' }]);
    expect(parts('address_group', {})).toEqual(['street', 'city', 'state', 'postal', 'country', 'apartment']);
  });

  it('drops invalid shapes and cannot replace a built-in part', () => {
    registerCompositeParts('address_group', [
      null,
      'city',
      { part: 'Bad-Name', value: 'x' },
      { part: 'ok' },
      { part: 'city', value: 'city2' },
      { part: 'town', value: 'city' },
      { part: 'pc', value: 'pc', alias: 'postal' },
    ]);
    expect(compositeKnownKeys('address_group')).toEqual(['street_address', 'street', 'street_address_2', 'street2', 'city', 'state', 'postal_code', 'postal', 'country']);
    expect(parts('address_group', {})).toEqual(['street', 'city', 'state', 'postal', 'country']);
  });

  it('hides data parts from the drawn parts and never demands them', () => {
    registerCompositeParts('address_group', [
      { part: 'lat', value: 'lat', data: true },
      { part: 'lng', value: 'lng', data: true },
    ]);
    expect(parts('address_group', {})).not.toContain('lat');
    expect(compositeDataParts('address_group').map((p) => p.value)).toEqual(['lat', 'lng']);
    expect(compositeKnownKeys('address_group')).toEqual(
      expect.arrayContaining(['street_address', 'street', 'postal_code', 'postal', 'lat', 'lng'])
    );
    const full = { street_address: 'a', city: 'b', state: 'c', postal_code: 'd', country: 'e' };
    expect(missingParts('address_group', {}, full)).toEqual([]);
  });

  it('lists added parts the builder can set, but not data parts', () => {
    registerCompositeParts('address_group', [
      { part: 'apartment', value: 'apartment', label: 'Apartment', toggleable: true },
      { part: 'lat', value: 'lat', data: true },
    ]);
    const keys = compositeSubfields('address_group', [{ key: 'street', label: 'Street', toggleable: false }]).map((s) => s.key);
    expect(keys).toEqual(['street', 'apartment']);
  });
});
