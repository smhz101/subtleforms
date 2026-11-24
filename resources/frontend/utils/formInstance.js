/**
 * Which copy of a form this is, so a form placed twice on one page does not
 * hand out the same element ids twice.
 *
 * The first live copy of a form id is copy 1 and keeps the ids it has always
 * had, so custom CSS and scripts that target `#subtleforms-field-<key>` keep
 * working on the usual single-form page. Later copies get their number in the
 * id. A copy that unmounts frees its number for the next one.
 */
const live = new Map();

/** Claim the lowest free copy number for this form id. */
export function claimInstance(formId) {
  const key = String(formId);
  let taken = live.get(key);
  if (!taken) {
    taken = new Set();
    live.set(key, taken);
  }
  let n = 1;
  while (taken.has(n)) n += 1;
  taken.add(n);
  return n;
}

/** Give a copy number back when that copy leaves the page. */
export function releaseInstance(formId, n) {
  const key = String(formId);
  const taken = live.get(key);
  if (!taken) return;
  taken.delete(n);
  if (taken.size === 0) live.delete(key);
}

function safePath(path, pattern) {
  return String(path || '').replace(pattern, '-');
}

/**
 * The base id of a field: `subtleforms-field-<path>` for copy 1 and
 * `subtleforms-field-<n>-<path>` for later copies.
 */
export function fieldDomId(path, instance = 1) {
  const prefix = instance > 1 ? `subtleforms-field-${instance}-` : 'subtleforms-field-';
  return prefix + safePath(path, /[^a-zA-Z0-9\-_:.]/g);
}

/** The base id of a repeater, numbered the same way. */
export function repeaterDomId(path, instance = 1) {
  const prefix = instance > 1 ? `subtleforms-repeater-${instance}-` : 'subtleforms-repeater-';
  return prefix + safePath(path, /[^a-zA-Z0-9\-_]/g);
}
