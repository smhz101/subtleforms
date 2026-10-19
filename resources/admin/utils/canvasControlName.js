/**
 * Accessible name for a decorative canvas control.
 *
 * @param {Object} field  Field being drawn.
 * @param {string} option Option label, when the control is one choice.
 * @return {string}
 */
export function canvasControlName( field, option ) {
	const label = ( field && ( field.label || field.key ) ) || 'Field';
	if ( option ) {
		return `${ label }: ${ option }`;
	}
	return label;
}
