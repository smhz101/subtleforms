/**
 * The submissions API accepts at most 100 rows a request. The list fetches
 * several pages of rows at once, as many as fit in that limit.
 */
export const MAX_API_PAGE_SIZE = 100;

/**
 * How many pages one request fetches.
 *
 * @param {number} perPage  Rows per page.
 * @param {number} maxPages Most pages wanted in one request.
 * @return {number} At least 1.
 */
export function chunkPagesFor(perPage, maxPages) {
  const size = Math.max(1, parseInt(perPage, 10) || 1);
  return Math.max(1, Math.min(maxPages, Math.floor(MAX_API_PAGE_SIZE / size)));
}
