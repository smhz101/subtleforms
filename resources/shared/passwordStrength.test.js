import {
  passwordStrength,
  passwordRules,
  unmetRules,
  meetsStrength,
  hasPasswordRules,
} from './passwordStrength';

// The same list and levels are asserted in tests/unit/PasswordRulesTest.php.
const SAMPLES = [
  ['', 'none'],
  ['abc', 'weak'],
  ['abcdefgh', 'weak'],
  ['Abcdefgh', 'fair'],
  ['Abcdefg1', 'good'],
  ['Abcdef1!', 'strong'],
  ['Abcdefghij1!', 'strong'],
  ['abcdefgh ijkl', 'good'],
];

test.each(SAMPLES)('strength of %j is %s', (value, level) => {
  expect(passwordStrength(value)).toBe(level);
});

test('a default field has no rules to show', () => {
  expect(hasPasswordRules({ minLength: 8, strengthMeter: true })).toBe(false);
  expect(hasPasswordRules({ requireNumber: true })).toBe(true);
  expect(hasPasswordRules({ minStrength: 'fair' })).toBe(true);
});

test('passwordRules lists the active rules in order', () => {
  const ids = passwordRules({
    minLength: 10,
    requireUppercase: true,
    requireSymbol: true,
    minStrength: 'good',
  }).map((r) => r.id);
  expect(ids).toEqual(['length', 'uppercase', 'symbol', 'strength']);
});

test('unmetRules returns only the broken character rules', () => {
  const config = { requireUppercase: true, requireLowercase: true, requireNumber: true, requireSymbol: true };
  expect(unmetRules('abc', config).map((r) => r.id)).toEqual(['uppercase', 'number', 'symbol']);
  expect(unmetRules('Abc1!', config)).toEqual([]);
  expect(unmetRules('abc', {})).toEqual([]);
});

test('meetsStrength compares against minStrength', () => {
  expect(meetsStrength('abc', { minStrength: 'any' })).toBe(true);
  expect(meetsStrength('abcdefgh', { minStrength: 'fair' })).toBe(false);
  expect(meetsStrength('Abcdefg1', { minStrength: 'good' })).toBe(true);
  expect(meetsStrength('Abcdefg1', { minStrength: 'strong' })).toBe(false);
});
