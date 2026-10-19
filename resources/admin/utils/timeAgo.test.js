import { timeAgo } from './formatDate';

describe('timeAgo (UX2-28)', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  test('one hour is singular', () => {
    expect(timeAgo('2026-10-20 11:00:00', now)).toBe('1 hour ago');
  });

  test('several hours are plural', () => {
    expect(timeAgo('2026-10-20 09:00:00', now)).toBe('3 hours ago');
  });

  test('minutes and days use the right form', () => {
    expect(timeAgo('2026-10-20 11:59:00', now)).toBe('1 minute ago');
    expect(timeAgo('2026-10-20 11:50:00', now)).toBe('10 minutes ago');
    expect(timeAgo('2026-10-19 12:00:00', now)).toBe('1 day ago');
    expect(timeAgo('2026-10-17 12:00:00', now)).toBe('3 days ago');
  });

  test('under a minute is just now, and stored UTC is read as UTC', () => {
    expect(timeAgo('2026-10-20 11:59:30', now)).toBe('Just now');
    expect(timeAgo('', now)).toBe('');
  });
});
