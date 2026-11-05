import { chunkPages } from './listBatches';

/**
 * The Forms list requests its rows in batches. This builds the request path
 * and reads a batch the server sent with the page, so both use one string.
 */

/**
 * @param {Object} o
 * @param {string} o.statusFilter  Tab: 'all', 'published', 'draft', 'trash'.
 * @param {string} o.searchTerm    Search text.
 * @param {string} o.sortBy        Column.
 * @param {string} o.sortDirection 'asc' or 'desc'.
 * @param {number} o.page          Batch number, from 1.
 * @param {number} o.perPage       Rows in the batch.
 * @return {string} Path below the namespace, e.g. '/forms?orderby=...'.
 */
export function formsBatchPath( { statusFilter, searchTerm, sortBy, sortDirection, page, perPage } ) {
	const params = new URLSearchParams( { orderby: sortBy, order: sortDirection } );
	if ( searchTerm ) {
		params.append( 'search', searchTerm );
	}
	if ( statusFilter && statusFilter !== 'all' ) {
		params.append( 'status', statusFilter );
	}
	params.set( 'page', String( page ) );
	params.set( 'per_page', String( perPage ) );
	return `/forms?${ params }`;
}

/**
 * The first batch, when it came with the page.
 *
 * @param {Function} take    takePreloaded( fullPath ) -> { body } | null.
 * @param {Object}   filters Same keys as formsBatchPath, without page and perPage; perPage is the page size.
 * @return {?{rows: Array, total: number}} Null when nothing was preloaded.
 */
export function preloadedFormsBatch( take, filters ) {
	const pageSize = filters.perPage;
	const batch = pageSize * chunkPages( pageSize );
	const entry = take( `/subtleforms/v1${ formsBatchPath( { ...filters, page: 1, perPage: batch } ) }` );
	const data = entry && entry.body;
	if ( ! data || ! Array.isArray( data.data ) ) {
		return null;
	}
	const total = data.meta && typeof data.meta.total === 'number' ? data.meta.total : data.data.length;
	return { rows: data.data, total };
}
