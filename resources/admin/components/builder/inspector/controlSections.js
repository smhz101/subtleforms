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
 * Which block of the settings panel draws a control.
 *
 *   content   what the field says: the `general` controls (label, help text,
 *             block content).
 *   subfields the parts of a Name or Address field.
 *   type      the settings of a layout block (Repeater, Step, Notice).
 *   rules     the `validation` controls.
 *   advanced  the `advanced` controls.
 *   styles    the `appearance` controls of a field that takes an answer
 *             (they sit on the Styles tab, grouped by styleGroup()).
 *   none      a section the panel never drew (the chained levels control sits
 *             in `choices` and has its own section).
 *
 * Every control of a definition lands in exactly one block.
 *
 * @param {Object} ctrl     Control with `section` resolved (see resolveControls()).
 * @param {boolean} isLayout Whether the field type is a layout block.
 * @return {string} Block name.
 */
export function controlBlock( ctrl, isLayout ) {
	if ( ctrl.type === 'subfield' ) {
		return 'subfields';
	}
	if ( ctrl.section === 'validation' ) {
		return 'rules';
	}
	if ( ctrl.section === 'advanced' ) {
		return 'advanced';
	}
	if ( ctrl.section === 'general' ) {
		return 'content';
	}
	if ( ctrl.section !== 'appearance' ) {
		return 'none';
	}
	// What a block says is content even when its definition files it under
	// `appearance` (the HTML block's content).
	if ( GENERAL_CONTROLS.includes( ctrl.key ?? ctrl.name ) ) {
		return 'content';
	}
	return isLayout ? 'type' : 'styles';
}

/**
 * The Styles tab group an appearance control belongs to, named after what the
 * control does and derived from its name: Label (label visibility), Help text
 * (help text placement), Input (placeholder, default value, prefix, suffix and the rest).
 *
 * @param {Object} ctrl Control with `section` resolved.
 * @return {string} Group id: label, help, layout or input.
 */
export function styleGroup( ctrl ) {
	const name = String( ctrl?.key ?? ctrl?.name ?? '' ).toLowerCase();
	if ( /help|description/.test( name ) ) {
		return 'help';
	}
	if ( /label/.test( name ) ) {
		return 'label';
	}
	if ( /layout|width|column|spacing/.test( name ) ) {
		return 'layout';
	}
	return 'input';
}

/** A filter for DynamicInspectorPanel that keeps the controls of one block. */
export function blockPicker( block, isLayout ) {
	return ( ctrl ) => controlBlock( ctrl, isLayout ) === block;
}

/** A filter that keeps the Styles controls of one group (see styleGroup()). */
export function styleGroupPicker( groupId ) {
	return ( ctrl ) => controlBlock( ctrl, false ) === 'styles' && styleGroup( ctrl ) === groupId;
}

/**
 * Whether a definition has a control that passes a filter.
 *
 * @param {Object}   def  Field definition.
 * @param {Function} pick Filter over controls with `section` resolved.
 * @return {boolean} True when one control passes.
 */
export function hasControls( def, pick ) {
	return resolveControls( def ).some( pick );
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
