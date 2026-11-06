import { INBOX_TABS, normalizeInboxTab, tabFromParams, buildInboxTabs } from './inboxTabs';
import { COUNT_TABS } from './tabCounts';

describe('Submissions tabs', () => {
  test('Unread is a tab, right after All', () => {
    expect(INBOX_TABS).toEqual(['all', 'unread', 'read', 'spam', 'starred', 'flagged', 'trash']);
  });

  test('the old New link opens Unread; anything unknown opens All', () => {
    expect(normalizeInboxTab('unread')).toBe('unread');
    expect(normalizeInboxTab('new')).toBe('unread');
    expect(normalizeInboxTab('nonsense')).toBe('all');
    expect(normalizeInboxTab(null)).toBe('all');
    expect(normalizeInboxTab('')).toBe('all');
  });

  test('every tab is kept', () => {
    for (const tab of INBOX_TABS) {
      expect(normalizeInboxTab(tab)).toBe(tab);
    }
  });

  test('every tab has a count', () => {
    INBOX_TABS.forEach((tab) => expect(COUNT_TABS).toContain(tab));
  });

  test('addresses open the right tab', () => {
    expect(tabFromParams(new URLSearchParams('tab=unread'))).toBe('unread');
    expect(tabFromParams(new URLSearchParams('unread=1'))).toBe('unread');
    expect(tabFromParams(new URLSearchParams('tab=spam'))).toBe('spam');
    expect(tabFromParams(new URLSearchParams(''))).toBe('all');
  });

  test('the tab bar lists Unread after All with its count, and hides zero counts', () => {
    const tabs = buildInboxTabs({ all: 363, unread: 31, spam: 0 }, (key) => key);
    expect(tabs.map((t) => t.key)).toEqual(['all', 'unread', 'read', 'spam', 'starred', 'flagged', 'trash']);
    expect(tabs[1].count).toBe(31);
    expect(tabs[3].count).toBeUndefined();
  });
});
