/**
 * Keyboard helpers for listboxes and calendar grids (FLD2-04, FLD2-05).
 */

export function typeaheadIndex(labels, buffer, fromIndex = -1) {
  const query = String(buffer || '').toLowerCase();
  const list = (Array.isArray(labels) ? labels : []).map((label) => String(label || '').toLowerCase());
  if (!query || list.length === 0) {
    return fromIndex;
  }
  const start = (fromIndex + 1 + list.length) % list.length;
  for (let step = 0; step < list.length; step += 1) {
    const index = (start + step) % list.length;
    if (list[index].startsWith(query)) {
      return index;
    }
  }
  return fromIndex;
}

export function moveGrid(index, key, columns = 7, total = Number.POSITIVE_INFINITY) {
  let next = index;
  if (key === 'ArrowRight') next = index + 1;
  else if (key === 'ArrowLeft') next = index - 1;
  else if (key === 'ArrowDown') next = index + columns;
  else if (key === 'ArrowUp') next = index - columns;
  else return index;
  if (next < 0 || next >= total) {
    return index;
  }
  return next;
}
