import { moveDate, moveGrid, moveIndex, typeaheadIndex } from './pickerKeyboard';

test('typing jumps to the matching choice and arrows move a week', () => {
  expect(typeaheadIndex(['Apple', 'Banana', 'Cherry'], 'b', 0)).toBe(1);
  expect(moveGrid(0, 'ArrowRight', 7, 42)).toBe(1);
  expect(moveGrid(0, 'ArrowDown', 7, 42)).toBe(7);
  expect(moveGrid(0, 'ArrowLeft', 7, 42)).toBe(0);
});

test('calendar keys move by day, week, week edge and month', () => {
  const d = new Date(2025, 0, 31); // Friday
  expect(moveDate(d, 'ArrowRight').getDate()).toBe(1);
  expect(moveDate(d, 'ArrowRight').getMonth()).toBe(1);
  expect(moveDate(d, 'ArrowUp').getDate()).toBe(24);
  expect(moveDate(d, 'Home', 0).getDate()).toBe(26);
  expect(moveDate(d, 'End', 0).getDate()).toBe(1);
  expect(moveDate(d, 'Home', 1).getDate()).toBe(27);
  const pd = moveDate(d, 'PageDown');
  expect([pd.getMonth(), pd.getDate()]).toEqual([1, 28]);
  expect(moveDate(d, 'PageUp').getMonth()).toBe(11);
  expect(moveDate(d, 'a')).toBeNull();
});

test('column keys step, jump to the ends and stay inside the list', () => {
  expect(moveIndex(3, 'ArrowDown', 24)).toBe(4);
  expect(moveIndex(0, 'ArrowUp', 24)).toBe(0);
  expect(moveIndex(3, 'End', 24)).toBe(23);
  expect(moveIndex(3, 'Home', 24)).toBe(0);
  expect(moveIndex(20, 'PageDown', 24)).toBe(23);
  expect(moveIndex(3, 'x', 24)).toBe(-1);
  expect(moveIndex(0, 'ArrowDown', 0)).toBe(-1);
});
