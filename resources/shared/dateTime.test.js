import {
  formatPhp,
  isIsoDateInRange,
  joinDateTime,
  monthCells,
  parseIsoDate,
  parseTime,
  splitDateTime,
  toIsoDate,
  toTime,
} from './dateTime';

describe('dateTime values', () => {
  test('round-trips an ISO date and rejects a calendar that does not exist', () => {
    const date = parseIsoDate('2026-10-17');
    expect(toIsoDate(date)).toBe('2026-10-17');
    expect(parseIsoDate('2026-02-31')).toBeNull();
  });

  test('formats with PHP tokens and keeps escaped letters', () => {
    const date = new Date(2026, 9, 17, 15, 5);
    expect(formatPhp(date, 'Y-m-d')).toBe('2026-10-17');
    expect(formatPhp(date, 'H:i')).toBe('15:05');
    expect(formatPhp(date, 'g:i A')).toBe('3:05 PM');
    expect(formatPhp(date, '\\Y-m-d')).toBe('Y-10-17');
  });

  test('splits and joins a date-time without dropping either half', () => {
    expect(splitDateTime('2026-10-17T15:05')).toEqual({ date: '2026-10-17', time: '15:05' });
    expect(splitDateTime('2026-10-17 15:05')).toEqual({ date: '2026-10-17', time: '15:05' });
    expect(joinDateTime('2026-10-17', '15:05')).toBe('2026-10-17T15:05');
    expect(joinDateTime('2026-10-17', '')).toBe('2026-10-17');
  });

  test('keeps clock values inside a day', () => {
    expect(parseTime('09:30')).toEqual({ hours: 9, minutes: 30 });
    expect(parseTime('24:00')).toBeNull();
    expect(toTime(9, 5)).toBe('09:05');
  });

  test('compares ISO dates as a range and builds a full month grid', () => {
    expect(isIsoDateInRange('2026-10-17', '2026-10-01', '2026-10-31')).toBe(true);
    expect(isIsoDateInRange('2026-09-30', '2026-10-01', '')).toBe(false);
    const cells = monthCells(new Date(2026, 9, 17));
    expect(cells).toHaveLength(42);
    expect(cells[0].getDay()).toBe(0);
    expect(cells.some((day) => toIsoDate(day) === '2026-10-17')).toBe(true);
  });
});
