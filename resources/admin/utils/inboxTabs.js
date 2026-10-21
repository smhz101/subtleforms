/**
 * Tabs of the Submissions screen. Unread entries are listed under All (each
 * carries its own unread mark), so there is no tab for them. The unread
 * count and status stay in the data for the menu badge and the API.
 */
export const INBOX_TABS = ['all', 'read', 'spam', 'starred', 'flagged', 'trash'];

/**
 * A tab key from the URL as a tab that exists. Anything else, including the
 * removed "unread" and "new" tabs from old links, is All.
 *
 * @param {string|null|undefined} tab Tab key.
 * @return {string} A key from INBOX_TABS.
 */
export function normalizeInboxTab(tab) {
  return INBOX_TABS.includes(tab) ? tab : 'all';
}
