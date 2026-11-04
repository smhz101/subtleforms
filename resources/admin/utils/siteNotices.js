/**
 * Notices from WordPress and other plugins on SubtleForms screens.
 *
 * Core prints admin notices at the top of #wpbody-content, above the app. The
 * app collects them into one region under its header instead. They are moved,
 * never copied or hidden, so each keeps its markup and the dismiss handler core
 * attached, and no `admin_notices` callback is touched.
 */

export const NOTICE_SELECTOR =
  '.notice, .error, .updated, .update-nag, .notice-error, .notice-warning, .notice-success, .notice-info';

/** Notices shown before the rest fold behind a button. */
export const VISIBLE_LIMIT = 2;

export const FOLDED_CLASS = 'sf-site-notice--folded';
const STASH_ID = 'sf-notice-stash';

function isSkipped(el) {
  return (
    el.hidden ||
    el.classList.contains('hidden') ||
    el.classList.contains('screen-reader-text') ||
    el.classList.contains('inline') ||
    el.classList.contains('below-h2') ||
    el.getAttribute('aria-hidden') === 'true'
  );
}

/**
 * A holding place for notices while no shell is mounted (between pages of the
 * app), so a notice survives navigation and is never shown above the header.
 */
export function getStash(create = true) {
  let stash = document.getElementById(STASH_ID);
  if (!stash && create) {
    const host = document.getElementById('wpbody-content');
    if (!host) return null;
    stash = document.createElement('div');
    stash.id = STASH_ID;
    stash.hidden = true;
    host.appendChild(stash);
  }
  return stash;
}

/**
 * The notices that are waiting outside the app: direct children of
 * #wpbody-content or of the SubtleForms .wrap (never inside the app root),
 * plus anything parked in the stash.
 */
export function findPendingNotices(doc = document) {
  const host = doc.getElementById('wpbody-content');
  if (!host) return [];
  const appRoot = doc.getElementById('subtleforms-admin-app');
  const parents = [host];
  host.querySelectorAll(':scope > .wrap').forEach((wrap) => {
    if (appRoot && wrap.contains(appRoot)) parents.push(wrap);
  });
  const stash = doc.getElementById(STASH_ID);
  if (stash) parents.push(stash);

  const found = [];
  parents.forEach((parent) => {
    Array.from(parent.children).forEach((child) => {
      if (child === appRoot || (appRoot && child.contains(appRoot))) return;
      if (child.matches(NOTICE_SELECTOR) && !isSkipped(child)) found.push(child);
    });
  });
  return found;
}

/**
 * Move waiting notices into `list`.
 *
 * @return {number} How many were moved.
 */
export function relocateNotices(list, doc = document) {
  if (!list) return 0;
  const pending = findPendingNotices(doc).filter((node) => !list.contains(node));
  pending.forEach((node) => list.appendChild(node));
  return pending.length;
}

/** Give the notices back to the stash when the shell goes away. */
export function stashNotices(list) {
  if (!list || !list.children.length) return;
  const stash = getStash();
  if (!stash) return;
  Array.from(list.children).forEach((node) => stash.appendChild(node));
}

function isError(node) {
  return node.classList.contains('notice-error') || node.classList.contains('error');
}

/**
 * Fold every notice after the first VISIBLE_LIMIT. Errors never fold.
 *
 * @param {Element} list
 * @param {boolean} collapse
 * @return {number} How many notices are foldable.
 */
export function foldNotices(list, collapse) {
  if (!list) return 0;
  const nodes = Array.from(list.children);
  let foldable = 0;
  nodes.forEach((node, index) => {
    const fold = index >= VISIBLE_LIMIT && !isError(node);
    if (fold) foldable += 1;
    node.classList.toggle(FOLDED_CLASS, fold && collapse);
  });
  return foldable;
}
