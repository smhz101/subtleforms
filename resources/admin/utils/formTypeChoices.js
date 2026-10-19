import { __ } from '@wordpress/i18n';

/**
 * The three form types, with the names used everywhere in the admin.
 *
 * @return {Array<{id: string, label: string}>}
 */
export function formTypeChoices() {
	return [
		{ id: 'regular', label: __( 'Standard', 'subtleforms' ) },
		{ id: 'multi-step', label: __( 'Multi-step', 'subtleforms' ) },
		{ id: 'conversational', label: __( 'Conversational', 'subtleforms' ) },
	];
}

/**
 * Visible name for a stored type. Legacy sectioned forms read as Multi-step.
 *
 * @param {string} type Stored type id.
 * @return {string}
 */
export function formTypeLabel( type ) {
	if ( type === 'sectioned' || type === 'multistep' ) {
		return __( 'Multi-step', 'subtleforms' );
	}
	const match = formTypeChoices().find( ( choice ) => choice.id === type );
	return match ? match.label : __( 'Standard', 'subtleforms' );
}
