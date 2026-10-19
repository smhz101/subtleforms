import { logicOperatorsFor, logicValueChoices, sameCheckValue } from './logicFields';

test('checkbox rules offer checked and unchecked, not every operator', () => {
  expect(logicOperatorsFor('checkbox')).toEqual(['equals', 'not_equals', 'empty', 'not_empty']);
  expect(logicValueChoices({ type: 'checkbox' })).toEqual([
    { label: 'Checked', value: 'true' },
    { label: 'Unchecked', value: 'false' },
  ]);
  expect(sameCheckValue(true, 'yes')).toBe(true);
  expect(sameCheckValue(false, 'unchecked')).toBe(true);
  expect(sameCheckValue('hello', 'no')).toBe(false);
});

test('a toggle off value is a choice, and text fields keep every operator', () => {
  expect(logicValueChoices({ type: 'toggle', onValue: 'yes', offValue: 'no' })).toEqual([
    { label: 'On', value: 'yes' },
    { label: 'Off', value: 'no' },
  ]);
  expect(logicOperatorsFor('text')).toBeNull();
});
