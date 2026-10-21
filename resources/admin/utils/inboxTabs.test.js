import { INBOX_TABS, normalizeInboxTab } from './inboxTabs';
import { COUNT_TABS } from './tabCounts';

describe('Submissions tabs', () => {
  test('there is no New tab', () => {
    expect(INBOX_TABS).not.toContain('unread');
    expect(INBOX_TABS).not.toContain('new');
  });

  test('old New links open All', () => {
    expect(normalizeInboxTab('unread')).toBe('all');
    expect(normalizeInboxTab('new')).toBe('all');
    expect(normalizeInboxTab('nonsense')).toBe('all');
    expect(normalizeInboxTab(null)).toBe('all');
    expect(normalizeInboxTab('')).toBe('all');
  });

  test('the other tabs are kept', () => {
    for (const tab of ['all', 'read', 'spam', 'starred', 'flagged', 'trash']) {
      expect(normalizeInboxTab(tab)).toBe(tab);
    }
  });

  test('the unread count is still counted for the badge', () => {
    expect(COUNT_TABS).toContain('unread');
  });
});
