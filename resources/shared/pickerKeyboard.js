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

/**
 * The date a calendar key press moves to, or null when the key is not a
 * calendar key. Arrows move a day or a week, Home and End go to the start
 * and end of the week, PageUp and PageDown to the same day a month away.
 */
export function moveDate(date, key, weekStartsOn = 0) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const startOn = ((Number(weekStartsOn) % 7) + 7) % 7 || 0;
  switch (key) {
    case 'ArrowLeft':
      return new Date(year, month, day - 1);
    case 'ArrowRight':
      return new Date(year, month, day + 1);
    case 'ArrowUp':
      return new Date(year, month, day - 7);
    case 'ArrowDown':
      return new Date(year, month, day + 7);
    case 'Home':
      return new Date(year, month, day - ((date.getDay() - startOn + 7) % 7));
    case 'End':
      return new Date(year, month, day + (6 - ((date.getDay() - startOn + 7) % 7)));
    case 'PageUp':
    case 'PageDown': {
      const target = month + (key === 'PageUp' ? -1 : 1);
      const lastDay = new Date(year, target + 1, 0).getDate();
      return new Date(year, target, Math.min(day, lastDay));
    }
    default:
      return null;
  }
}

/**
 * The index a key press moves to in a vertical list (the hour and minute
 * columns), or -1 when the key does not move. Arrows step by one, Home and
 * End go to the ends, PageUp and PageDown step by `page`.
 */
export function moveIndex(index, key, total, page = 10) {
  if (total <= 0) {
    return -1;
  }
  let next = index;
  if (key === 'ArrowDown') next = index + 1;
  else if (key === 'ArrowUp') next = index - 1;
  else if (key === 'PageDown') next = index + page;
  else if (key === 'PageUp') next = index - page;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = total - 1;
  else return -1;
  return Math.min(total - 1, Math.max(0, next));
}
