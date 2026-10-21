/**
 * Tab counts of the Submissions screen.
 *
 * The server sends one number per tab (GET /submissions/unread-count). When an
 * entry changes in the browser, the numbers move at once, by working out which
 * tabs the entry was in before and which it is in now. The server's answer
 * that follows replaces the estimate, so a mistake here never lasts.
 */

export const COUNT_TABS = ['all', 'unread', 'read', 'spam', 'starred', 'flagged', 'trash'];

/** Counts with every tab at zero. */
export function emptyCounts() {
  return COUNT_TABS.reduce((counts, key) => ({ ...counts, [key]: 0 }), {});
}

/**
 * Counts from a server answer. Missing or odd values become zero.
 *
 * @param {Object|undefined} raw Counts as sent by the server.
 * @return {Object} Counts for every tab.
 */
export function normalizeCounts(raw) {
  const counts = emptyCounts();
  if (!raw || typeof raw !== 'object') {
    return counts;
  }
  COUNT_TABS.forEach((key) => {
    const value = parseInt(raw[key], 10);
    counts[key] = Number.isFinite(value) && value > 0 ? value : 0;
  });
  return counts;
}

/**
 * The tabs an entry is listed under. The Trash only holds trashed entries;
 * every other tab leaves them out.
 *
 * @param {Object|null} entry Entry with status, is_read and starred.
 * @return {string[]} Tab keys.
 */
export function tabsFor(entry) {
  if (!entry) {
    return [];
  }
  if (entry.status === 'trash') {
    return ['trash'];
  }
  const tabs = ['all', parseInt(entry.is_read, 10) === 1 ? 'read' : 'unread'];
  if (entry.status === 'spam') {
    tabs.push('spam');
  }
  if (entry.status === 'flagged') {
    tabs.push('flagged');
  }
  if (parseInt(entry.starred, 10) === 1) {
    tabs.push('starred');
  }
  return tabs;
}

/**
 * Move the counts for one entry going from one state to another. Pass null as
 * `after` when the entry is gone (deleted for good), null as `before` for a
 * new entry.
 *
 * @param {Object} counts Current counts.
 * @param {Object|null} before Entry state before the change.
 * @param {Object|null} after Entry state after the change.
 * @return {Object} New counts, never below zero.
 */
export function applyChange(counts, before, after) {
  const next = { ...normalizeCounts(counts) };
  tabsFor(before).forEach((key) => {
    next[key] -= 1;
  });
  tabsFor(after).forEach((key) => {
    next[key] += 1;
  });
  COUNT_TABS.forEach((key) => {
    next[key] = Math.max(0, next[key]);
  });
  return next;
}

/**
 * Apply a list of changes in order.
 *
 * @param {Object} counts Current counts.
 * @param {Array<{before: Object|null, after: Object|null}>} changes Changes.
 * @return {Object} New counts.
 */
export function applyChanges(counts, changes) {
  return (changes || []).reduce(
    (current, change) => applyChange(current, change.before, change.after),
    normalizeCounts(counts)
  );
}

/**
 * The entry fields a bulk action changes. `restore` is the Flag toggle going
 * back to a plain entry; `untrash` brings an entry back from the Trash.
 *
 * @param {string} action Bulk action.
 * @param {Object} entry Entry before the action.
 * @return {Object|null} Entry after the action, or null when it is gone.
 */
export function entryAfter(action, entry) {
  switch (action) {
    case 'read':
      return { ...entry, is_read: 1 };
    case 'unread':
      return { ...entry, is_read: 0 };
    case 'star':
      return { ...entry, starred: 1 };
    case 'unstar':
      return { ...entry, starred: 0 };
    case 'spam':
      return { ...entry, status: 'spam' };
    case 'flagged':
      return { ...entry, status: 'flagged' };
    case 'restore':
      return { ...entry, status: 'completed' };
    case 'trash':
      return { ...entry, status: 'trash' };
    case 'untrash':
      return { ...entry, status: entry.trashed_from && entry.trashed_from !== 'trash' ? entry.trashed_from : 'completed' };
    case 'delete':
      return null;
    default:
      return entry;
  }
}
