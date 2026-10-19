/**
 * Unflag sends a status the API allows. completed is rejected.
 *
 * @param {boolean} isFlagged Whether the entry is flagged now.
 * @return {string}
 */
export function nextReviewStatus(isFlagged) {
  return isFlagged ? 'none' : 'flagged';
}
