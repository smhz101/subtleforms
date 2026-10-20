/**
 * @jest-environment node
 */
import { formatRelativeDate } from './formatDate';

describe('formatRelativeDate (UX2-28)', () => {
  it('uses singular hour for one hour ago', () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(hourAgo)).toMatch(/1 hour ago/);
    expect(formatRelativeDate(hourAgo)).not.toMatch(/1 hours ago/);
  });
});
