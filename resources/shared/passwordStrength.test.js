import { passwordStrength } from './passwordStrength';

test('a short password is weak and a mixed long one is strong', () => {
  expect(passwordStrength('abc')).toBe('weak');
  expect(passwordStrength('Correct-horse1')).toBe('strong');
});
