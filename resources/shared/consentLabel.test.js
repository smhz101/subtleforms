import { consentParts } from './consentLabel';

test('links the words already in the consent sentence', () => {
  const parts = consentParts(
    'I agree to the Privacy Policy.',
    'https://example.com/privacy',
    'Privacy Policy'
  );
  expect(parts.map((part) => part.text).join('')).toBe('I agree to the Privacy Policy.');
  expect(parts.filter((part) => part.url)).toEqual([
    { text: 'Privacy Policy', url: 'https://example.com/privacy' },
  ]);
});

test('still replaces the {{link}} placeholder', () => {
  const parts = consentParts('I agree to the {{link}}.', 'https://example.com/privacy', 'Privacy Policy');
  expect(parts.map((part) => part.text).join('')).toBe('I agree to the Privacy Policy.');
});
