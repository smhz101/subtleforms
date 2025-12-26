/**
 * Submissions Feature API
 *
 * All submission-related API calls.
 */

import { apiGet, apiPost } from '../../utils/api';

export async function getSubmissions(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const path = queryString ? `/submissions?${queryString}` : '/submissions';
  return await apiGet(path);
}

export async function getSubmission(id) {
  return await apiGet(`/submissions/${id}`);
}

export async function updateSubmissionStatus(id, status) {
  return await apiPost(`/submissions/${id}/status`, { status });
}
