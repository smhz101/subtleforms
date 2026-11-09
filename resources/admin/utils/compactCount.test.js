import { formatCompactCount } from './compactCount';

describe('formatCompactCount', () => {
  test.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1000, '1k'],
    [1049, '1k'],
    [1200, '1.2k'],
    [1999, '1.9k'],
    [9999, '9.9k'],
    [10000, '10k'],
    [12345, '12k'],
    [999999, '999k'],
    [1000000, '1M'],
    [1250000, '1.2M'],
    [12000000, '12M'],
  ])('%s becomes %s', (value, expected) => {
    expect(formatCompactCount(value)).toBe(expected);
  });

  test('bad input is 0', () => {
    expect(formatCompactCount(undefined)).toBe('0');
    expect(formatCompactCount('abc')).toBe('0');
    expect(formatCompactCount(-5)).toBe('0');
  });
});
