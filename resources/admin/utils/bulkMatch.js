/**
 * Bulk actions on every entry that matches the view (not only the page).
 * The server finds the entries from the same filters the list sends.
 */

/** List key of a bulk action to the server action it runs on the whole view. */
export const MATCH_ACTIONS = {
  read: 'read',
  unread: 'unread',
  star: 'star',
  unstar: 'unstar',
  spam: 'spam',
  flagged: 'flagged',
  restore: 'untrash',
  'not-spam': 'restore',
  trash: 'trash',
  delete: 'delete',
};

/** Actions that ask first when they apply to a whole view. */
export const MATCH_DESTRUCTIVE = ['spam', 'trash', 'delete'];

/**
 * The list filters of the current view, in the names the list sends.
 *
 * @param {Object} view formId, statusFilter (the tab), searchTerm, fieldValue, processingStatus, dateRange.
 * @return {Object} Filters; empty values are left out.
 */
export function matchFilters({ formId, statusFilter, searchTerm, fieldValue, processingStatus, dateRange }) {
  const filters = {};
  if (formId) filters.form_id = formId;
  if (statusFilter && statusFilter !== 'all') filters.status = statusFilter;
  if (searchTerm) filters.search = searchTerm;
  if (fieldValue) filters.field_value = fieldValue;
  if (processingStatus) filters.processing_status = processingStatus;
  if (dateRange && dateRange !== 'all') filters.range = dateRange;
  return filters;
}

/**
 * The body of the bulk request for a whole view: match and filters, no ids.
 *
 * @param {string} action Server action.
 * @param {Object} view See matchFilters().
 * @return {Object} Request body.
 */
export function matchBulkBody(action, view) {
  return { match: true, action, ...matchFilters(view) };
}
