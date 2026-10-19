/**
 * A hidden field toolbar must leave the tab order. aria-hidden alone does not.
 *
 * @param {boolean} visible Whether the toolbar is showing.
 * @return {Object} Props for the toolbar element.
 */
export function toolbarVisibilityProps( visible ) {
	if ( visible ) {
		return { 'aria-hidden': false };
	}
	return {
		'aria-hidden': true,
		inert: '',
	};
}

/**
 * @param {boolean} visible Whether the toolbar is showing.
 * @return {number|undefined} tabIndex for a toolbar button.
 */
export function toolbarButtonTabIndex( visible ) {
	return visible ? undefined : -1;
}
