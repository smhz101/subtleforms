import { columnCountFromType } from './columnCount';

test('column containers use their word, not NaN', () => {
  expect(columnCountFromType('two_column_container')).toBe(2);
  expect(columnCountFromType('three_column_container')).toBe(3);
  expect(columnCountFromType('four_column_container')).toBe(4);
  expect(columnCountFromType('2_column_container')).toBe(2);
  expect(columnCountFromType('text')).toBe(0);
});
