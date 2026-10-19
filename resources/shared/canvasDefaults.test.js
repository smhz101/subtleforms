import { choiceShowsDefault } from './canvasDefaults';

test('canvas choices preview their defaults', () => {
  expect(choiceShowsDefault('green', 'green')).toBe(true);
  expect(choiceShowsDefault('green', 'red')).toBe(false);
  expect(choiceShowsDefault(['one', 'two'], 'two')).toBe(true);
  expect(choiceShowsDefault('one, two', 'two')).toBe(true);
});
