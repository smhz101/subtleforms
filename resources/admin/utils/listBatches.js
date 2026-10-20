/**
 * How many list pages one request fetches. The forms route accepts at most
 * 100 rows per request (Schemas::validatePagination), so larger page sizes
 * fetch fewer pages at a time instead of failing (review of #47).
 */

/** Most rows the list routes return in one request. */
export const MAX_ROWS_PER_REQUEST = 100;

/** Pages fetched together when they fit. */
const PREFERRED_PAGES = 5;

/**
 * @param {number} perPage Rows per page.
 * @return {number} Pages per request, at least 1.
 */
export function chunkPages(perPage) {
	const size = Math.max(1, parseInt(perPage, 10) || 1);
	return Math.max(1, Math.min(PREFERRED_PAGES, Math.floor(MAX_ROWS_PER_REQUEST / size)));
}
