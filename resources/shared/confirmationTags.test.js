import { fillConfirmation } from './confirmationTags';

describe('fillConfirmation', () => {
  it('fills field, form title and entry id', () => {
    const text = 'Hello {field:name}. {form_title} #{entry_id}';
    expect(fillConfirmation(text, {
      values: { name: 'Ada' },
      formTitle: 'Join',
      entryId: 12,
    })).toBe('Hello Ada. Join #12');
  });

  it('encodes a redirect value and drops a missing field', () => {
    expect(fillConfirmation('https://example.com/?n={field:name}', {
      values: { name: 'A B' },
      encode: true,
    })).toBe('https://example.com/?n=A%20B');
    expect(fillConfirmation('Hi {field:gone}', { values: {} })).toBe('Hi ');
  });

  it('fills one part of an object answer', () => {
    const values = { addr: { city: 'Lahore', lat: 31.5, nested: { a: 1 } }, rep: [{ city: 'Lahore' }] };
    expect(fillConfirmation('{field:addr:city} {{field:addr:lat}} {addr:city}', { values })).toBe('Lahore 31.5 Lahore');
    expect(fillConfirmation('[{field:addr:nope}][{field:addr:nested}][{field:rep:city}][{field:gone:city}]', { values })).toBe('[][][][]');
    expect(fillConfirmation('{zzz:city}', { values })).toBe('{zzz:city}');
    expect(fillConfirmation('?c={field:addr:city}', { values: { addr: { city: 'A B' } }, encode: true })).toBe('?c=A%20B');
  });

  it('keeps the plain tag as it was', () => {
    expect(fillConfirmation('{field:addr}', { values: { addr: { city: 'Lahore', zip: '54000' } } })).toBe('Lahore 54000');
  });

  it('reads a part name as well as an answer key', () => {
    const values = {
      addr: { street_address: '1 Main', postal_code: '54000', city: 'Lahore' },
      who: { first_name: 'Ada', last_name: 'Lovelace' },
    };
    const fieldTypes = { addr: 'address_group', who: 'name_group' };
    const run = (t, extra = {}) => fillConfirmation(t, { values, fieldTypes, ...extra });
    expect(run('{field:addr:street}|{field:addr:postal}|{field:addr:street_address}')).toBe('1 Main|54000|1 Main');
    expect(run('{field:who:first_name} {field:who:last_name}')).toBe('Ada Lovelace');
    expect(run('[{field:addr:nope}][{field:who:nope}]')).toBe('[][]');
    // Without the types, the part names of both composite types are tried.
    expect(fillConfirmation('{field:addr:street}', { values })).toBe('1 Main');
  });
});
