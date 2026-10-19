/**
 * Mark one buffered row read. Returns whether it changed.
 *
 * @param {Array} rows Table rows.
 * @param {string|number} id Entry id.
 * @return {{rows: Array, changed: boolean}}
 */
export function markRowRead(rows, id) {
  let changed = false;
  const next = (rows || []).map((row) => {
    if (String(row.id) !== String(id)) {
      return row;
    }
    if (parseInt(row.is_read, 10) === 1) {
      return row;
    }
    changed = true;
    return { ...row, is_read: 1 };
  });
  return { rows: next, changed };
}
