import { __, sprintf } from '@wordpress/i18n';

/**
 * How many real fields a schema holds. Steps are boundaries, not fields.
 *
 * @param {Object} schema Form schema.
 * @return {number}
 */
export function countSchemaFields( schema ) {
	let count = 0;
	const walk = ( fields ) => {
		if ( ! Array.isArray( fields ) ) {
			return;
		}
		fields.forEach( ( field ) => {
			if ( ! field || typeof field !== 'object' ) {
				return;
			}
			if ( field.type && field.type !== 'step' ) {
				count += 1;
			}
			// Multi-step and container schemas store nested fields in children.
			// Older schemas used fields. Prefer children when that list is present.
			const nested = Array.isArray( field.children ) ? field.children : field.fields;
			walk( nested );
		} );
	};
	walk( schema?.fields );
	return count;
}

/**
 * Snackbar copy after one or more fields leave the schema.
 *
 * @param {number} removed How many fields were removed.
 * @return {string} Empty when nothing was removed.
 */
export function fieldDeletedMessage( removed ) {
	const count = Number( removed ) || 0;
	if ( count <= 0 ) {
		return '';
	}
	if ( count === 1 ) {
		return __( 'Field deleted.', 'subtleforms' );
	}
	return sprintf(
		/* translators: %d: number of fields removed */
		__( '%d fields deleted.', 'subtleforms' ),
		count
	);
}
