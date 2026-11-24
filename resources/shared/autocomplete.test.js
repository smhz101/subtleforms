import { inferAutocomplete, autocompleteOptions, AUTOCOMPLETE_TOKEN_LIST } from './autocomplete';

const text = (key, label = '') => ({ type: 'text', key, label });

describe('inferAutocomplete', () => {
  test.each([
    ['name', 'name'],
    ['full_name', 'name'],
    ['your-name', 'name'],
    ['first_name', 'given-name'],
    ['given_name', 'given-name'],
    ['forename', 'given-name'],
    ['last_name', 'family-name'],
    ['surname', 'family-name'],
    ['family_name', 'family-name'],
    ['company', 'organization'],
    ['organization', 'organization'],
    ['organisation', 'organization'],
    ['business', 'organization'],
    ['job_title', 'organization-title'],
    ['position', 'organization-title'],
    ['role', 'organization-title'],
    ['city', 'address-level2'],
    ['town', 'address-level2'],
    ['zip', 'postal-code'],
    ['postcode', 'postal-code'],
    ['postal_code', 'postal-code'],
  ])('key %s gives %s', (key, token) => {
    expect(inferAutocomplete(text(key))).toBe(token);
  });

  test('the label is used when the key says nothing', () => {
    expect(inferAutocomplete(text('field_1', 'First name'))).toBe('given-name');
    expect(inferAutocomplete(text('field_2', 'Your Name'))).toBe('name');
    expect(inferAutocomplete(text('field_3', 'Job title'))).toBe('organization-title');
  });

  test('the key wins over the label', () => {
    expect(inferAutocomplete(text('company', 'Your name'))).toBe('organization');
  });

  test('a specific phrase wins over the general name', () => {
    expect(inferAutocomplete(text('first_name', 'Name'))).toBe('given-name');
    expect(inferAutocomplete(text('company_name'))).toBe('organization');
  });

  test('no match gives an empty token', () => {
    expect(inferAutocomplete(text('notes', 'Notes'))).toBe('');
    expect(inferAutocomplete(text('field_9', 'Anything else'))).toBe('');
    expect(inferAutocomplete({})).toBe('');
    expect(inferAutocomplete(null)).toBe('');
  });

  test('matches whole words only', () => {
    expect(inferAutocomplete(text('username'))).toBe('');
    expect(inferAutocomplete(text('rename', 'Rename file'))).toBe('');
    expect(inferAutocomplete(text('citywide'))).toBe('');
    expect(inferAutocomplete(text('zipper'))).toBe('');
    expect(inferAutocomplete(text('enrolment', 'Role play'))).toBe('organization-title');
  });

  test('only Text fields are inferred', () => {
    expect(inferAutocomplete({ type: 'textarea', key: 'name' })).toBe('');
    expect(inferAutocomplete({ type: 'email', key: 'name' })).toBe('');
  });

  test('reads a key and label held in config', () => {
    expect(inferAutocomplete({ type: 'text', config: { key: 'surname' } })).toBe('family-name');
  });
});

describe('autocomplete options', () => {
  test('lists every allowed token in order, Automatic first', () => {
    expect(autocompleteOptions().map((o) => o.value)).toEqual(AUTOCOMPLETE_TOKEN_LIST);
    expect(autocompleteOptions()[0]).toEqual({ value: '', label: 'Automatic' });
    expect(autocompleteOptions()[1]).toEqual({ value: 'off', label: 'Off' });
  });
});
