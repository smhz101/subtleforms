/**
 * Whether a failed reload may keep the rows already on screen.
 *
 * Same query: a refresh failed, so the previous rows are still the right ones.
 * A different tab, search, or sort must not keep them, or Trash can show
 * the forms from Published.
 *
 * @param {string} loadedKey  Query that produced the current rows. Empty if none.
 * @param {string} requestKey Query that just failed.
 * @return {boolean}
 */
export function keepRowsAfterFailedLoad( loadedKey, requestKey ) {
	return loadedKey !== '' && loadedKey === requestKey;
}

/**
 * Stable key for the filters that choose which rows are on screen.
 *
 * @param {Array} parts Filter values, in a fixed order.
 * @return {string}
 */
export function listQueryKey( parts ) {
	return ( parts || [] ).map( ( part ) => String( part ?? '' ) ).join( '\u0000' );
}
