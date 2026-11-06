/**
 * Tabs of the Submissions screen. Unread lists the entries nobody has opened
 * yet; All still lists them too, each with its own unread mark. The Dashboard
 * Unread tile, the admin bar and the WordPress dashboard widget link to it.
 */
export const INBOX_TABS = ['all', 'unread', 'read', 'spam', 'starred', 'flagged', 'trash'];

/**
 * A tab key from the URL as a tab that exists. The old "new" tab is Unread;
 * anything else that is not a tab is All.
 *
 * @param {string|null|undefined} tab Tab key.
 * @return {string} A key from INBOX_TABS.
 */
/**
 * The tab a Submissions address opens. `?unread=1` (older links, the admin
 * menu) is the Unread tab.
 *
 * @param {URLSearchParams} params Address parameters.
 * @return {string} A key from INBOX_TABS.
 */
export function tabFromParams(params) {
  if (params.get('unread') === '1') {
    return 'unread';
  }
  return normalizeInboxTab(params.get('tab') || 'all');
}

/**
 * The tabs in order, with counts (a zero count shows nothing).
 *
 * @param {Object}   counts Counts by tab key.
 * @param {Function} label  Label of a tab key.
 * @return {Array<{key:string,label:string,count:number|undefined}>} Tabs.
 */
export function buildInboxTabs(counts, label) {
  return INBOX_TABS.map((key) => ({ key, label: label(key), count: counts[key] > 0 ? counts[key] : undefined }));
}

export function normalizeInboxTab(tab) {
  if (tab === 'new') {
    return 'unread';
  }
  return INBOX_TABS.includes(tab) ? tab : 'all';
}
