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
});
