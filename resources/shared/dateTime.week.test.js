import { dayName, monthCells } from './dateTime';

test('week start shifts the grid and a day has a full name', () => {
  const october = new Date(2026, 9, 1);
  expect(monthCells(october)[0].getDay()).toBe(0);
  expect(monthCells(october, 1)[0].getDay()).toBe(1);
  expect(dayName(new Date(2026, 9, 15), 'en-US')).toBe('October 15, 2026');
});
