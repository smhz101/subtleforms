/**
 * Dashboard "Spam blocked" card (2.6.0): the 30-day sentence, bars a
 * keyboard and a screen reader can reach, the breakdown in plain words and
 * the empty state.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import SpamBlockedCard, { spamHeadline } from './SpamBlockedCard';

const mockUseSpamStats = jest.fn();
jest.mock('../data', () => ({
  useSpamStats: (...args) => mockUseSpamStats(...args),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function days(counts) {
  const start = Date.UTC(2026, 8, 23);
  return counts.map((count, i) => ({
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    count,
  }));
}

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SpamBlockedCard {...props} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('SpamBlockedCard', () => {
  beforeEach(() => {
    mockUseSpamStats.mockReset();
    mockUseSpamStats.mockReturnValue({ data: undefined, isError: false, refetch: jest.fn() });
  });

  test('says how much spam was blocked in the last 30 days', () => {
    expect(spamHeadline(143)).toBe('SubtleForms blocked 143 spam messages in the last 30 days.');
    expect(spamHeadline(1)).toBe('SubtleForms blocked 1 spam message in the last 30 days.');
    expect(spamHeadline(0)).toBe('No spam blocked yet.');
  });

  test('shows the total, one bar per day and the reasons in plain words', () => {
    const counts = Array(30).fill(0);
    counts[29] = 3;
    counts[10] = 140;
    const { container, unmount } = mount({
      stats: {
        total: 143,
        days: days(counts),
        reasons: { honeypot: 120, time_trap: 20, rate_limit: 2, captcha_failed: 1, spam_rule: 0, other: 0 },
      },
    });

    expect(container.textContent).toContain('SubtleForms blocked 143 spam messages in the last 30 days.');
    expect(container.querySelector('h2').textContent).toBe('Spam blocked');

    const bars = container.querySelectorAll('.sf-trend__col');
    expect(bars).toHaveLength(30);
    bars.forEach((bar) => {
      expect(bar.getAttribute('tabindex')).toBe('0');
      expect(bar.getAttribute('role')).toBe('img');
      expect(bar.getAttribute('aria-label')).toMatch(/: \d+ blocked$/);
    });
    expect(container.querySelector('caption').textContent).toBe('Spam blocked per day, last 30 days');

    const reasons = [...container.querySelectorAll('.sf-spam-card__reason-label')].map((el) => el.textContent);
    expect(reasons).toEqual(['Hidden trap field', 'Sent too fast', 'Too many tries', 'Failed CAPTCHA']);
    expect(container.querySelector('.sf-spam-card__reasons ul').getAttribute('aria-labelledby')).toBe('sf-spam-card-reasons');
    expect(mockUseSpamStats).toHaveBeenCalledWith({ days: 30 }, { enabled: false });
    unmount();
  });

  test('shows the empty state without a chart', () => {
    const { container, unmount } = mount({
      stats: { total: 0, days: days(Array(30).fill(0)), reasons: {} },
    });

    expect(container.textContent).toContain('No spam blocked yet.');
    expect(container.querySelector('.sf-trend')).toBeNull();
    expect(container.querySelector('.sf-spam-card__reasons')).toBeNull();
    unmount();
  });

  test('loads its own counts and offers a retry when they fail', () => {
    const refetch = jest.fn();
    mockUseSpamStats.mockReturnValue({ data: undefined, isError: true, refetch });
    const { container, unmount } = mount({});

    expect(mockUseSpamStats).toHaveBeenCalledWith({ days: 30 }, { enabled: true });
    expect(container.querySelector('[role="alert"]').textContent).toContain('Spam counts could not be loaded.');
    act(() => container.querySelector('button').click());
    expect(refetch).toHaveBeenCalled();
    unmount();
  });
});
