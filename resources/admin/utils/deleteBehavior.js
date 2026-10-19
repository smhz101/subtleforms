/**
 * Whether a delete removes the row for good.
 *
 * Hard delete never uses the Trash. A row that is already in the Trash is
 * removed for good either way.
 *
 * @param {string} behavior Saved delete_behavior.
 * @param {boolean} alreadyTrashed Row is in the Trash.
 * @return {boolean}
 */
export function deletesPermanently(behavior, alreadyTrashed) {
  return alreadyTrashed || behavior === 'hard';
}
