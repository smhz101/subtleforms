import { registerFieldType } from '../../shared/extend';
import { validateField, normalizeUrl } from './fieldValidation';

/**
 * F240-1: the browser and the server apply one rule per field type.
 */
const check = (type, value, config = {}) => validateField({ type, key: 'f', config }, value);

describe('email (FB-05, FB-06)', () => {
  test('several addresses are accepted when the field allows them', () => {
    expect(check('email', 'a@example.com, b@example.com', { allowMultiple: true })).toBeUndefined();
    expect(check('email', 'a@example.com, nope', { allowMultiple: true })).toBe('Invalid email address.');
    expect(check('email', 'a@example.com, b@example.com')).toBe('Invalid email address.');
  });

  test('RFC validation off accepts an address without a dot in the domain', () => {
    expect(check('email', 'user@localhost', { rfcValidation: false })).toBeUndefined();
    expect(check('email', 'user@localhost')).toBe('Invalid email address.');
    expect(check('email', 'user@', { rfcValidation: false })).toBe('Invalid email address.');
  });
});

describe('website (FB-15)', () => {
  test('a bare domain is accepted and gets https://', () => {
    expect(check('url', 'example.com')).toBeUndefined();
    expect(normalizeUrl('example.com/about')).toBe('https://example.com/about');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  test('other schemes are refused, as on the server', () => {
    expect(check('url', 'ftp://example.com')).toBe('Invalid URL.');
    expect(check('url', 'javascript:alert(1)')).toBe('Invalid URL.');
  });
});

describe('dates, times and colours (FA-01)', () => {
  test('values must be real', () => {
    expect(check('date', 'not-a-date')).toBe('Please enter a valid date.');
    expect(check('date', '2026-02-30')).toBe('Please enter a valid date.');
    expect(check('date', '2026-02-28')).toBeUndefined();
    expect(check('time', '99:99')).toBe('Please enter a valid time.');
    expect(check('time', '09:30')).toBeUndefined();
    expect(check('datetime', 'garbage')).toBe('Please enter a valid date and time.');
    expect(check('datetime', '2026-10-20T09:30')).toBeUndefined();
    expect(check('color_picker', 'javascript:alert(1)')).toBe(
      'Please enter a colour as a hex value, such as #336699.'
    );
    expect(check('color_picker', '#336699')).toBeUndefined();
  });
});

describe('phone (FLD2-07)', () => {
  test('an international number needs a real code and length', () => {
    expect(check('phone', '+1 5')).toBe('Invalid phone number.');
    expect(check('phone', '+999 123')).toBe('Invalid phone number.');
    expect(check('phone', '+1 4155550100')).toBeUndefined();
    expect(check('phone', '+44 7700900123')).toBeUndefined();
  });
});

describe('rich text (FA-17)', () => {
  test('a required editor with no text is empty', () => {
    expect(check('rich_text', '<p><br></p>', { required: true })).toBe('This field is required.');
    expect(check('rich_text', '<p>Hi</p>', { required: true })).toBeUndefined();
  });
});

describe('add-on field types check their own answers (P1-01)', () => {
  test('a registered validate() runs for a non-empty answer', () => {
    registerFieldType('example_amount', {
      component: () => null,
      validate: (value, config) => (Number(value) < (config.min || 0) ? 'Too small.' : null),
    });
    expect(check('example_amount', '1', { min: 5 })).toBe('Too small.');
    expect(check('example_amount', '50', { min: 5 })).toBeUndefined();
    expect(check('example_amount', '', { min: 5 })).toBeUndefined();
  });
});

