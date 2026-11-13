import {
  formatPhp,
  formatExample,
  parseTyped,
  parseWithFormat,
  resolveDateLimit,
  resolveFormat,
  splitFormat,
  FORMAT_PRESETS,
} from './dateTime';

const vectors = require('../../tests/fixtures/datetime-format-vectors.json').vectors;

const asDate = (value) => {
  const [d, t] = value.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [h, i] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, i);
};

describe('the formatter writes what the server writes (shared vectors)', () => {
  vectors.forEach((row) => {
    test(`${row.format} -> ${row.expected}`, () => {
      expect(formatPhp(asDate(row.value), row.format, 'en-US')).toBe(row.expected);
    });
  });
});

describe('typed entry reads the display format back', () => {
  vectors.filter((row) => row.roundTrip).forEach((row) => {
    test(`${row.mode}: "${row.expected}" is ${row.value}`, () => {
      const [day, clock] = row.value.split(' ');
      const stored = { date: day, time: clock, datetime: `${day}T${clock}` }[row.mode];
      // A date only stores the day; the clock of the vector is not part of it.
      expect(parseTyped(row.expected, row.mode, row.format, 'en-US')).toBe(stored);
    });
  });

  test('every preset round trips', () => {
    const sample = asDate('2026-11-13 14:30');
    Object.entries(FORMAT_PRESETS).forEach(([mode, formats]) => {
      formats.forEach((format) => {
        const text = formatPhp(sample, format, 'en-US');
        const parsed = parseTyped(text, mode, format, 'en-US');
        expect(parsed).toBe({ date: '2026-11-13', time: '14:30', datetime: '2026-11-13T14:30' }[mode]);
      });
    });
  });

  test('falls back to ISO and the common shapes whatever the format is', () => {
    expect(parseTyped('2026-11-13', 'date', 'j F Y', 'en-US')).toBe('2026-11-13');
    expect(parseTyped('13/11/2026', 'date', 'Y-m-d', 'en-US')).toBe('2026-11-13');
    // 11/13/2026 cannot be day first, so it is month first.
    expect(parseTyped('11/13/2026', 'date', 'Y-m-d', 'en-US')).toBe('2026-11-13');
    expect(parseTyped('13.11.2026', 'date', 'Y-m-d', 'en-US')).toBe('2026-11-13');
    expect(parseTyped('14:30', 'time', 'g:i A', 'en-US')).toBe('14:30');
    expect(parseTyped('2:30 pm', 'time', 'H:i', 'en-US')).toBe('14:30');
    expect(parseTyped('2026-11-13 14:30', 'datetime', 'j F Y, g:i A', 'en-US')).toBe('2026-11-13T14:30');
    expect(parseTyped('13/11/2026 2:30 pm', 'datetime', 'Y-m-d H:i', 'en-US')).toBe('2026-11-13T14:30');
  });

  test('a date and time field accepts a date alone', () => {
    expect(parseTyped('13/11/2026', 'datetime', 'd/m/Y H:i', 'en-US')).toBe('2026-11-13');
  });

  test('rejects text that is not a date, a time or a real day', () => {
    expect(parseTyped('tomorrow', 'date', 'Y-m-d', 'en-US')).toBeNull();
    expect(parseTyped('31/02/2026', 'date', 'd/m/Y', 'en-US')).toBeNull();
    expect(parseTyped('2026-13-01', 'date', 'Y-m-d', 'en-US')).toBeNull();
    expect(parseTyped('25:00', 'time', 'H:i', 'en-US')).toBeNull();
    expect(parseTyped('13:70', 'time', 'H:i', 'en-US')).toBeNull();
    expect(parseTyped('14', 'time', 'H:i', 'en-US')).toBeNull();
    expect(parseTyped('13 Foo 2026', 'date', 'j F Y', 'en-US')).toBeNull();
    expect(parseTyped('', 'date', 'Y-m-d', 'en-US')).toBeNull();
  });

  test('reads month names in the site language', () => {
    expect(parseTyped('13 November 2026', 'date', 'j F Y', 'de-DE')).toBe('2026-11-13');
    expect(parseTyped('13 März 2026', 'date', 'j F Y', 'de-DE')).toBe('2026-03-13');
  });

  test('parseWithFormat returns the parts', () => {
    expect(parseWithFormat('13/11/2026', 'd/m/Y', 'en-US')).toEqual({ day: 13, month: 11, year: 2026 });
    expect(parseWithFormat('13/11', 'd/m/Y', 'en-US')).toBeNull();
  });
});

describe('format resolution', () => {
  beforeEach(() => {
    window.subtleformsFrontend = { dateFormat: 'j. F Y', timeFormat: 'H:i' };
  });
  afterEach(() => {
    delete window.subtleformsFrontend;
  });

  test('site joins the site date and time formats with a comma', () => {
    expect(resolveFormat('date', { format: 'site' })).toBe('j. F Y');
    expect(resolveFormat('time', { format: 'site' })).toBe('H:i');
    expect(resolveFormat('datetime', { format: 'site' })).toBe('j. F Y, H:i');
  });

  test('custom uses the custom text, a preset or a saved 2.8 format is used as it is', () => {
    expect(resolveFormat('date', { format: 'custom', customFormat: 'd-m-y' })).toBe('d-m-y');
    expect(resolveFormat('date', { format: 'custom' })).toBe('Y-m-d');
    expect(resolveFormat('date', { format: 'd/m/Y' })).toBe('d/m/Y');
    expect(resolveFormat('time', {})).toBe('H:i');
    expect(resolveFormat('datetime', {})).toBe('Y-m-d H:i');
  });

  test('splits a date and time format at the first time letter', () => {
    expect(splitFormat('j F Y, g:i A')).toEqual({ date: 'j F Y', time: 'g:i A' });
    expect(splitFormat('Y-m-d H:i')).toEqual({ date: 'Y-m-d', time: 'H:i' });
    expect(splitFormat('d/m/Y')).toEqual({ date: 'd/m/Y', time: '' });
  });

  test('the example is the format written for a fixed day', () => {
    expect(formatExample('d/m/Y', 'en-US')).toBe('13/11/2026');
    expect(formatExample('H:i', 'en-US')).toBe('14:30');
  });
});

describe('earliest and latest date expressions', () => {
  const today = new Date(2026, 10, 13);

  test('ISO dates are kept, a day that does not exist is no limit', () => {
    expect(resolveDateLimit('2026-12-01', today)).toBe('2026-12-01');
    expect(resolveDateLimit('2026-02-31', today)).toBe('');
  });

  test('relative expressions count from today', () => {
    expect(resolveDateLimit('today', today)).toBe('2026-11-13');
    expect(resolveDateLimit('tomorrow', today)).toBe('2026-11-14');
    expect(resolveDateLimit('yesterday', today)).toBe('2026-11-12');
    expect(resolveDateLimit('+7 days', today)).toBe('2026-11-20');
    expect(resolveDateLimit('+1 week', today)).toBe('2026-11-20');
    expect(resolveDateLimit('-1 month', today)).toBe('2026-10-13');
    expect(resolveDateLimit('today +1 year', today)).toBe('2027-11-13');
    expect(resolveDateLimit('3 days ago', today)).toBe('2026-11-10');
  });

  test('something it does not know is no limit', () => {
    expect(resolveDateLimit('next blue moon', today)).toBe('');
    expect(resolveDateLimit('', today)).toBe('');
    expect(resolveDateLimit(null, today)).toBe('');
  });
});
