import vectors from '../../tests/fixtures/date-limit-vectors.json';
import { dateLimitMessage, timeLimitMessage } from './dateLimits';

const noon = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0);
};

describe('date limits match the shared vectors', () => {
  test.each(vectors.date.map((v, i) => [i, v]))('date vector %i', (_i, v) => {
    expect(dateLimitMessage(v.value, v.config, 'date', noon(v.today))).toBe(v.message);
  });

  test.each(vectors.datetime.map((v, i) => [i, v]))('datetime vector %i', (_i, v) => {
    expect(dateLimitMessage(v.value, v.config, 'datetime', noon(v.today))).toBe(v.message);
  });

  test.each(vectors.time.map((v, i) => [i, v]))('time vector %i', (_i, v) => {
    expect(timeLimitMessage(v.value, v.config, v.mode)).toBe(v.message);
  });
});

describe('"today" is the site day, not the visitor day', () => {
  const { siteNow } = require('./dateTime');
  afterEach(() => {
    delete window.subtleformsFrontend;
  });

  test('siteNow reads an IANA timezone', () => {
    window.subtleformsFrontend = { timezone: 'Pacific/Auckland' };
    // 2025-03-15 20:00 UTC is already 2025-03-16 09:00 in Auckland (UTC+13).
    const now = siteNow(new Date(Date.UTC(2025, 2, 15, 20, 0)));
    expect([now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()]).toEqual([2025, 2, 16, 9]);
  });

  test('siteNow reads a UTC offset', () => {
    window.subtleformsFrontend = { timezone: '-05:00' };
    const now = siteNow(new Date(Date.UTC(2025, 2, 15, 3, 30)));
    expect([now.getDate(), now.getHours(), now.getMinutes()]).toEqual([14, 22, 30]);
  });

  test('without a site timezone it is the visitor clock', () => {
    const at = new Date(2025, 2, 15, 10, 0);
    expect(siteNow(at)).toBe(at);
  });

  test('a minimum of today follows the site day in the limit message', () => {
    window.subtleformsFrontend = { timezone: 'Pacific/Auckland' };
    const at = new Date(Date.UTC(2025, 2, 15, 20, 0));
    // The visitor may be on the 15th, the site is on the 16th: the 15th is in the past.
    expect(dateLimitMessage('2025-03-15', { minDate: 'today' }, 'date', siteNow(at))).toBe('Pick a date on or after 2025-03-16.');
  });
});
