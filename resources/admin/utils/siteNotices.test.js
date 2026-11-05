import {
  findPendingNotices,
  relocateNotices,
  stashNotices,
  foldNotices,
  FOLDED_CLASS,
} from './siteNotices';

function page() {
  document.body.innerHTML = `
    <div id="wpbody-content">
      <div class="notice notice-success is-dismissible" id="a"><p>Purged</p></div>
      <div class="wrap subtleforms-admin">
        <hr class="wp-header-end">
        <div class="notice notice-info" id="b"><p>Info</p></div>
        <div id="subtleforms-admin-app"><div class="notice" id="inside"><p>App</p></div></div>
      </div>
      <div class="notice hidden" id="hidden"></div>
      <div class="notice inline" id="inline"></div>
      <p class="notice" id="p-notice"></p>
    </div>`;
  const list = document.createElement('div');
  document.getElementById('subtleforms-admin-app').appendChild(list);
  return list;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('site notices', () => {
  test('finds notices outside the app and ignores those inside it', () => {
    page();
    const ids = findPendingNotices().map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'p-notice']);
  });

  test('skips hidden and inline notices', () => {
    page();
    const ids = findPendingNotices().map((n) => n.id);
    expect(ids).not.toContain('hidden');
    expect(ids).not.toContain('inline');
  });

  test('moves matching nodes into the list and keeps their handlers', () => {
    const list = page();
    const handler = jest.fn();
    const a = document.getElementById('a');
    a.addEventListener('click', handler);
    expect(relocateNotices(list)).toBe(3);
    expect(list.contains(a)).toBe(true);
    expect(document.getElementById('inside').parentElement.id).toBe('subtleforms-admin-app');
    a.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(relocateNotices(list)).toBe(0);
  });

  test('moves a notice that is added later', () => {
    const list = page();
    relocateNotices(list);
    const late = document.createElement('div');
    late.className = 'notice notice-warning';
    document.getElementById('wpbody-content').appendChild(late);
    expect(relocateNotices(list)).toBe(1);
    expect(list.lastElementChild).toBe(late);
  });

  test('parks notices in a stash and takes them back', () => {
    const list = page();
    relocateNotices(list);
    stashNotices(list);
    expect(list.children.length).toBe(0);
    expect(document.getElementById('sf-notice-stash').children.length).toBe(3);
    expect(relocateNotices(list)).toBe(3);
  });

  test('folds everything after the second notice, but never errors', () => {
    document.body.innerHTML = '<div id="list"></div>';
    const list = document.getElementById('list');
    ['notice-success', 'notice-warning', 'notice-info', 'notice-error', 'notice-info'].forEach((cls) => {
      const el = document.createElement('div');
      el.className = `notice ${cls}`;
      list.appendChild(el);
    });
    expect(foldNotices(list, true)).toBe(2);
    expect(list.querySelectorAll(`.${FOLDED_CLASS}`).length).toBe(2);
    expect(list.children[3].classList.contains(FOLDED_CLASS)).toBe(false);
    expect(foldNotices(list, false)).toBe(2);
    expect(list.querySelectorAll(`.${FOLDED_CLASS}`).length).toBe(0);
  });
});
