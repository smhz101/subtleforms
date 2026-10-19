import { moveGrid, typeaheadIndex } from './pickerKeyboard';

test('typing jumps to the matching choice and arrows move a week', () => {
  expect(typeaheadIndex(['Apple', 'Banana', 'Cherry'], 'b', 0)).toBe(1);
  expect(moveGrid(0, 'ArrowRight', 7, 42)).toBe(1);
  expect(moveGrid(0, 'ArrowDown', 7, 42)).toBe(7);
  expect(moveGrid(0, 'ArrowLeft', 7, 42)).toBe(0);
});
