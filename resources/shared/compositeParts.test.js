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
