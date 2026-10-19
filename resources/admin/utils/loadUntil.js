/**
 * Keep loading list pages until a row is present or the list ends.
 *
 * @param {Object} options
 * @param {string|number} options.readingId Entry id.
 * @param {Function} options.getRows Current rows.
 * @param {Function} options.getTotal Total entries.
 * @param {Function} options.prefetch Loads the next page and resolves to the rows.
 * @return {Promise<boolean>} Whether the row was found.
 */
export async function loadUntilFound({ readingId, getRows, getTotal, prefetch }) {
  let guard = 0;
  while (guard < 50) {
    const rows = getRows() || [];
    if (rows.some((row) => String(row.id) === String(readingId))) {
      return true;
    }
    const total = Number(getTotal()) || 0;
    if (rows.length >= total) {
      return false;
    }
    const before = rows.length;
    const next = await prefetch();
    const after = Array.isArray(next) ? next.length : getRows().length;
    if (after <= before) {
      return false;
    }
    guard += 1;
  }
  return false;
}
