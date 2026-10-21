import {
  applyChange,
  applyChanges,
  entryAfter,
  normalizeCounts,
  tabsFor,
} from './tabCounts';

const counts = (over = {}) => ({ all: 10, unread: 4, read: 6, spam: 2, starred: 3, flagged: 1, trash: 5, ...over });
const entry = (over = {}) => ({ status: 'completed', is_read: 0, starred: 0, ...over });

describe('tabsFor', () => {
  it('lists the tabs an entry shows under', () => {
    expect(tabsFor(entry())).toEqual(['all', 'unread']);
    expect(tabsFor(entry({ is_read: 1, starred: 1, status: 'flagged' }))).toEqual(['all', 'read', 'flagged', 'starred']);
    expect(tabsFor(entry({ status: 'spam' }))).toEqual(['all', 'unread', 'spam']);
  });

  it('puts a trashed entry under Trash only', () => {
    expect(tabsFor(entry({ status: 'trash', starred: 1, is_read: 1 }))).toEqual(['trash']);
  });
});

describe('applyChange', () => {
  it('moves an entry to the Trash: leaves its tabs, joins Trash', () => {
    const before = entry({ starred: 1 });
    expect(applyChange(counts(), before, entryAfter('trash', before))).toEqual(
      counts({ all: 9, unread: 3, starred: 2, trash: 6 })
    );
  });

  it('restores an entry to the tabs it had', () => {
    const trashed = entry({ status: 'trash', trashed_from: 'spam', is_read: 1 });
    expect(applyChange(counts(), trashed, entryAfter('untrash', trashed))).toEqual(
      counts({ all: 11, read: 7, spam: 3, trash: 4 })
    );
  });

  it('restores to a plain entry when the old status is unknown', () => {
    const trashed = entry({ status: 'trash' });
    expect(entryAfter('untrash', trashed).status).toBe('completed');
  });

  it('deletes forever from the Trash', () => {
    const trashed = entry({ status: 'trash' });
    expect(applyChange(counts(), trashed, entryAfter('delete', trashed))).toEqual(counts({ trash: 4 }));
  });

  it.each([
    ['read', entry(), counts({ unread: 3, read: 7 })],
    ['unread', entry({ is_read: 1 }), counts({ unread: 5, read: 5 })],
    ['star', entry(), counts({ starred: 4 })],
    ['unstar', entry({ starred: 1 }), counts({ starred: 2 })],
    ['spam', entry(), counts({ spam: 3 })],
    ['flagged', entry(), counts({ flagged: 2 })],
    ['restore', entry({ status: 'flagged' }), counts({ flagged: 0 })],
  ])('%s moves only the tabs it touches', (action, before, expected) => {
    expect(applyChange(counts(), before, entryAfter(action, before))).toEqual(expected);
  });

  it('marking spam on a flagged entry moves it from Flagged to Spam', () => {
    const before = entry({ status: 'flagged' });
    expect(applyChange(counts(), before, entryAfter('spam', before))).toEqual(counts({ flagged: 0, spam: 3 }));
  });

  it('never goes below zero', () => {
    const before = entry({ status: 'trash' });
    expect(applyChange(counts({ trash: 0 }), before, null).trash).toBe(0);
  });

  it('a change that does nothing leaves the counts alone', () => {
    const before = entry({ is_read: 1 });
    expect(applyChange(counts(), before, entryAfter('read', before))).toEqual(counts());
  });
});

describe('applyChanges', () => {
  it('applies a bulk of entries in one go', () => {
    const rows = [entry(), entry({ is_read: 1 }), entry({ starred: 1 })];
    const changes = rows.map((row) => ({ before: row, after: entryAfter('trash', row) }));
    expect(applyChanges(counts(), changes)).toEqual(counts({ all: 7, unread: 2, read: 5, starred: 2, trash: 8 }));
  });

  it('a bulk that is undone returns to the starting counts', () => {
    const rows = [entry(), entry({ is_read: 1 }), entry({ starred: 1, status: 'spam' })];
    const trashed = rows.map((row) => ({ before: row, after: { ...entryAfter('trash', row), trashed_from: row.status } }));
    const after = applyChanges(counts(), trashed);
    const back = applyChanges(after, trashed.map((c) => ({ before: c.after, after: entryAfter('untrash', c.after) })));
    expect(back).toEqual(counts());
  });
});

describe('normalizeCounts', () => {
  it('fills missing and odd values with zero', () => {
    expect(normalizeCounts({ unread: '7', trash: -2, spam: 'x' })).toEqual({
      all: 0, unread: 7, read: 0, spam: 0, starred: 0, flagged: 0, trash: 0,
    });
    expect(normalizeCounts(undefined).all).toBe(0);
  });
});
