/**
 * Load every form, not just the first page.
 *
 * `GET /forms` returns 20 forms by default and at most 100 per page. Pickers
 * (the Submissions filter, the block's form picker) need all of them, so this
 * walks the pages until the server says there are no more.
 *
 * The request asks for the raw response (`parse: false`) because the admin
 * client's middleware unwraps the `{ data, meta }` envelope and drops
 * `meta.total_pages`. Both a raw `Response` and an already parsed body are
 * accepted, so a test can pass a plain `fetcher`.
 */
import apiFetch from '@wordpress/api-fetch';

export const FORMS_PER_PAGE = 100;
export const MAX_FORM_PAGES = 50;

const defaultFetcher = ( path ) => apiFetch( { path, parse: false } );

async function readBody( result ) {
	if ( result && typeof result.json === 'function' ) {
		return result.json();
	}
	return result;
}

function pageItems( body ) {
	if ( Array.isArray( body ) ) {
		return body;
	}
	return Array.isArray( body?.data ) ? body.data : [];
}

function totalPages( body ) {
	const raw =
		body?.meta?.total_pages ??
		body?.meta?.pagination?.total_pages ??
		body?._meta?.total_pages ??
		body?._pagination?.total_pages;
	const n = Number( raw );
	return Number.isFinite( n ) && n > 0 ? n : null;
}

function compareForms( a, b ) {
	const byTitle = String( a.title ).localeCompare( String( b.title ), undefined, {
		sensitivity: 'base',
	} );
	return byTitle !== 0 ? byTitle : a.id - b.id;
}

/**
 * @param {Object}   [options]
 * @param {string}   [options.status]  Only forms with this status.
 * @param {Function} [options.fetcher] `( path ) => Promise`, for tests.
 * @return {Promise<Array<{id:number,title:string}>>} Forms sorted by title, then id.
 */
export async function fetchAllForms( { status, fetcher = defaultFetcher } = {} ) {
	const forms = [];

	for ( let page = 1; page <= MAX_FORM_PAGES; page++ ) {
		let path = `/subtleforms/v1/forms?per_page=${ FORMS_PER_PAGE }&page=${ page }&orderby=id&order=ASC`;
		if ( status ) {
			path += `&status=${ encodeURIComponent( status ) }`;
		}

		const body = await readBody( await fetcher( path ) );
		const items = pageItems( body );
		items.forEach( ( form ) => {
			forms.push( { id: Number( form.id ), title: form.title ? String( form.title ) : '' } );
		} );

		const pages = totalPages( body );
		const done = pages !== null ? page >= pages : items.length < FORMS_PER_PAGE;
		if ( done || items.length === 0 ) {
			break;
		}
	}

	return forms.sort( compareForms );
}
