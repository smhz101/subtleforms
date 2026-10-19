/**
 * Browser history for the submissions list.
 *
 * Opening an entry pushes a history entry. Other admin URL updates replace
 * the current one, so Back returns to the list.
 */

export function historyMode(previous, next) {
	if (!previous) {
		return 'replace';
	}
	const opened = next.submission_id && !previous.submission_id && previous.page === next.page;
	return opened ? 'push' : 'replace';
}

/**
 * Map the current wp-admin URL back to an in-app route.
 *
 * @param {string} href Browser URL.
 * @return {string}
 */
export function adminUrlToRoute(href) {
	const url = new URL(href, 'http://localhost');
	const page = url.searchParams.get('page') || 'subtleforms';
	const formId = url.searchParams.get('form_id');
	const subId = url.searchParams.get('submission_id');
	const tab = url.searchParams.get('tab');
	const search = url.searchParams.get('search');
	const params = new URLSearchParams();
	if (formId) params.set('form_id', formId);
	if (tab && tab !== 'all') params.set('tab', tab);
	if (search) params.set('search', search);
	if (page === 'subtleforms-submissions') {
		if (subId && (window.subtleformsAdmin?.submissionsView?.reading_pane ?? 'right') === 'off') {
			return `/submissions/${subId}${params.toString() ? `?${params}` : ''}`;
		}
		if (subId) params.set('submission_id', subId);
		const query = params.toString();
		return query ? `/submissions?${query}` : '/submissions';
	}
	return '';
}

