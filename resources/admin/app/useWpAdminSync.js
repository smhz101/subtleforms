/**
 * Keep the browser URL, the WordPress admin menu and the document title in
 * step with in-app navigation.
 *
 * The app routes with a MemoryRouter, so without this a reload would always
 * land on the screen the page was first opened on, the admin submenu would
 * keep highlighting the wrong item, and the tab title would never change.
 * Using `history.replaceState` keeps the back button behaving like core.
 */

import { useEffect } from '@wordpress/element';
import { useLocation } from 'react-router-dom';

/**
 * Map an in-app route to the wp-admin query it corresponds to.
 *
 * @param {string} pathname Router pathname.
 * @param {string} search   Router search string.
 * @return {{page: string, params: Object}} wp-admin page slug and extra params.
 */
export function routeToAdminQuery(pathname, search = '') {
	const query = new URLSearchParams(search);
	const formId = query.get('form_id');
	const params = {};

	if (pathname === '/forms') {
		return { page: 'subtleforms-forms', params };
	}

	if (pathname === '/forms/new') {
		return { page: 'subtleforms-new-form', params };
	}

	const formMatch = pathname.match(/^\/forms\/(\d+)$/);
	if (formMatch) {
		return { page: 'subtleforms-new-form', params: { form_id: formMatch[1] } };
	}

	if (pathname === '/submissions') {
		if (formId) {
			params.form_id = formId;
		}
		return { page: 'subtleforms-submissions', params };
	}

	const subMatch = pathname.match(/^\/submissions\/(\d+)$/);
	if (subMatch) {
		params.submission_id = subMatch[1];
		if (formId) {
			params.form_id = formId;
		}
		return { page: 'subtleforms-submissions', params };
	}

	if (pathname === '/settings') {
		return { page: 'subtleforms-settings', params };
	}

	if (pathname === '/extensions') {
		return { page: 'subtleforms-extensions', params };
	}

	if (pathname === '/payments') {
		return { page: 'subtleforms-payments', params };
	}

	return { page: 'subtleforms', params };
}

/**
 * Highlight the matching item in the SubtleForms admin submenu.
 *
 * @param {string} page wp-admin page slug.
 */
function syncAdminMenu(page) {
	const menu = document.getElementById('toplevel_page_subtleforms');
	if (!menu) {
		return;
	}

	const items = menu.querySelectorAll('.wp-submenu li');
	items.forEach((li) => {
		const link = li.querySelector('a');
		if (!link) {
			return;
		}
		const href = link.getAttribute('href') || '';
		const linkPage = (href.match(/[?&]page=([^&#]+)/) || [])[1] || '';
		const isCurrent = linkPage === page;
		li.classList.toggle('current', isCurrent);
		link.classList.toggle('current', isCurrent);
		if (isCurrent) {
			link.setAttribute('aria-current', 'page');
		} else {
			link.removeAttribute('aria-current');
		}
	});
}

/**
 * Replace the first segment of the document title ("Forms ‹ Site — WordPress").
 *
 * @param {string} label Screen name.
 */
function syncTitle(label) {
	if (!label) {
		return;
	}
	const separator = ' ‹ ';
	const parts = document.title.split(separator);
	if (parts.length > 1) {
		parts[0] = label;
		document.title = parts.join(separator);
	}
}

/**
 * @param {Function} getLabel Maps a pathname to a human-readable screen name.
 */
export default function useWpAdminSync(getLabel) {
	const location = useLocation();

	useEffect(() => {
		const { page, params } = routeToAdminQuery(location.pathname, location.search);

		try {
			const url = new URL(window.location.href);
			// Rebuild the query so stale params (e.g. form_id) never leak across.
			const next = new URLSearchParams();
			next.set('page', page);
			Object.entries(params).forEach(([key, value]) => next.set(key, value));
			const nextUrl = `${url.pathname}?${next.toString()}${url.hash}`;
			if (nextUrl !== `${url.pathname}${url.search}${url.hash}`) {
				window.history.replaceState(window.history.state, '', nextUrl);
			}
		} catch (e) {
			// URL sync is a convenience; never break navigation over it.
		}

		// Editing an existing form highlights "All Forms", matching the PHP
		// submenu logic, rather than "Add New".
		syncAdminMenu(page === 'subtleforms-new-form' && params.form_id ? 'subtleforms-forms' : page);
		syncTitle(getLabel ? getLabel(location.pathname) : '');
	}, [location.pathname, location.search, getLabel]);
}
