import { formatUsPhone, isCompleteUsPhone } from './phoneFormat';

test('US format groups ten digits and rejects a short number', () => {
  expect(formatUsPhone('5550101234')).toBe('(555) 010-1234');
  expect(formatUsPhone('12')).toBe('12');
  expect(isCompleteUsPhone('(555) 010-1234')).toBe(true);
  expect(isCompleteUsPhone('12')).toBe(false);
});
