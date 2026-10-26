/**
 * Which inspector panel and tab each setting of a field type is drawn in.
 *
 * Kept free of components so the builder and its tests share one answer.
 */

import { typeHasFlag } from '../../../utils/fieldTypeFlags';

/**
 * Controls whose content belongs under General when the definition does not
 * name a section: what a block says (label, title, help text, notice text).
 */
const GENERAL_CONTROLS = [ 'label', 'title', 'description', 'content' ];

/**
 * The panel a control is drawn in: its own `section`, else General for
 * content controls and Appearance for the rest.
 *
 * @param {Object} ctrl Control definition.
 * @return {string} Section name.
 */
export function controlSection( ctrl ) {
	if ( ctrl?.section ) {
		return ctrl.section;
	}
	const name = ctrl?.name ?? ctrl?.key;
	return GENERAL_CONTROLS.includes( name ) ? 'general' : 'appearance';
}

/**
 * Every control a definition shows, once each, with its section resolved.
 * Layout types declare their own controls in layoutControls; the 2.0
 * settings model adds shared ones (CSS class) to inspectorControls.
 *
 * @param {Object} def Field definition.
 * @return {Array} Controls with `section` set.
 */
export function resolveControls( def ) {
	const isLayout = def?.meta?.category === 'layout';
	const layout = Array.isArray( def?.layoutControls ) ? def.layoutControls : [];
	const inspector = Array.isArray( def?.inspectorControls ) ? def.inspectorControls : [];
	const merged = isLayout ? [ ...layout, ...inspector ] : inspector;
	const seen = new Set();
	return merged
		.filter( ( ctrl ) => {
			const name = ctrl?.key ?? ctrl?.name;
			if ( ! name || seen.has( name ) ) return false;
			seen.add( name );
			return true;
		} )
		.map( ( ctrl ) => ( { ...ctrl, section: controlSection( ctrl ) } ) );
}

/**
 * Whether a definition draws any control in a section.
 *
 * @param {Object} def     Field definition.
 * @param {string} section Section name.
 * @return {boolean} True when at least one control is in that section.
 */
export function hasSection( def, section ) {
	return resolveControls( def ).some( ( c ) => c.section === section );
}

/**
 * Types that take no answer but can still be shown or hidden by logic: steps,
 * content blocks and the Repeater. An add-on type says the same with
 * `meta.logicOnly` (see isLogicOnlyType()).
 */
export const LOGIC_ONLY_TYPES = [
	'step',
	'html',
	'section_break',
	'disclaimer',
	'repeat_container',
];

/** Whether a type takes no answer but can be shown or hidden by logic. */
export function isLogicOnlyType( type ) {
	return LOGIC_ONLY_TYPES.includes( type ) || typeHasFlag( type, 'logicOnly' );
}
