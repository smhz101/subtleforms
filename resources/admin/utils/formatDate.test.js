/**
 * Site time zone dates: the admin shows the time in Settings, General, never
 * the browser's zone. Every format call must name its zone explicitly, so a
 * helper that falls back to the browser zone fails.
 */
import {
  formatSiteDateTime,
  siteZoneLabel,
  siteDateTitle,
} from './formatDate';

const NAIVE = '2026-11-20 11:07:17';
const ISO = '2026-11-20T11:07:17Z';

const setZone = (zone) => {
  window.subtleformsAdmin = zone === undefined ? {} : { timezone: zone };
};

// What the panel prints for a wall-clock time, built with the same options.
const wall = (y, mo, d, h, mi) =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, mo - 1, d, h, mi)));

describe('formatSiteDateTime', () => {
  const RealDtf = Intl.DateTimeFormat;
  let zonesUsed;
  beforeEach(() => {
    zonesUsed = [];
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
      zonesUsed.push(options && options.timeZone);
      return new RealDtf(locale, options);
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(() => {
    delete window.subtleformsAdmin;
  });

  it('shows UTC for a UTC site', () => {
    setZone('UTC');
    expect(formatSiteDateTime(NAIVE)).toBe(wall(2026, 11, 20, 11, 7));
  });

  it('shifts to an IANA zone (Asia/Karachi is UTC+5)', () => {
    setZone('Asia/Karachi');
    expect(formatSiteDateTime(NAIVE)).toBe(wall(2026, 11, 20, 16, 7));
  });

  it('applies a fixed offset east of UTC', () => {
    setZone('+05:30');
    expect(formatSiteDateTime(NAIVE)).toBe(wall(2026, 11, 20, 16, 37));
  });

  it('applies a fixed offset west of UTC and crosses midnight', () => {
    setZone('-03:00');
    expect(formatSiteDateTime(NAIVE)).toBe(wall(2026, 11, 20, 8, 7));
    expect(formatSiteDateTime('2026-11-20 01:00:00')).toBe(
      wall(2026, 11, 19, 22, 0)
    );
  });

  it('falls back to UTC, not the browser zone, when the zone is missing', () => {
    setZone(undefined);
    expect(formatSiteDateTime(NAIVE)).toBe(wall(2026, 11, 20, 11, 7));
  });

  it('falls back to UTC when the zone is not valid', () => {
    setZone('Mars/Olympus');
    expect(formatSiteDateTime(NAIVE)).toBe(wall(2026, 11, 20, 11, 7));
  });

  it('never formats without naming a zone (the browser zone is ignored)', () => {
    ['UTC', 'Asia/Karachi', '+05:30', '-03:00', undefined, 'Mars/Olympus'].forEach(
      (zone) => {
        setZone(zone);
        formatSiteDateTime(NAIVE);
      }
    );
    expect(zonesUsed.length).toBeGreaterThan(0);
    zonesUsed.forEach((zone) => expect(typeof zone).toBe('string'));
  });

  it('reads naive and ISO input as the same instant', () => {
    setZone('Asia/Karachi');
    expect(formatSiteDateTime(ISO)).toBe(formatSiteDateTime(NAIVE));
    expect(formatSiteDateTime('2026-11-20T16:07:17+05:00')).toBe(
      formatSiteDateTime(NAIVE)
    );
  });

  it('returns an empty string for an empty value and the raw text when unreadable', () => {
    setZone('UTC');
    expect(formatSiteDateTime('')).toBe('');
    expect(formatSiteDateTime(null)).toBe('');
    expect(formatSiteDateTime('not a date')).toBe('not a date');
  });
});

describe('siteZoneLabel and siteDateTitle', () => {
  afterAll(() => {
    delete window.subtleformsAdmin;
  });

  it('labels an IANA zone by its name', () => {
    setZone('Asia/Karachi');
    expect(siteZoneLabel()).toBe('Asia/Karachi');
  });

  it('labels fixed offsets as UTC plus or minus the offset', () => {
    setZone('+05:00');
    expect(siteZoneLabel()).toBe('UTC+05:00');
    setZone('-03:30');
    expect(siteZoneLabel()).toBe('UTC-03:30');
  });

  it('labels a missing zone as UTC', () => {
    setZone(undefined);
    expect(siteZoneLabel()).toBe('UTC');
  });

  it('puts the zone label after the date in the title', () => {
    setZone('Asia/Karachi');
    const title = siteDateTitle(NAIVE);
    expect(title).toBe(`${formatSiteDateTime(NAIVE)} (Asia/Karachi)`);
    expect(siteDateTitle('')).toBe('');
  });
});
