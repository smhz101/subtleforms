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
});
