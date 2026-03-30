/**
 * controlRegistry.js
 *
 * Maps PHP inspectorControls `type` strings to React control components.
 * Add new entries here when new control types are registered in PHP FieldDefinitions.
 */

import TextInspectorControl from './controls/TextInspectorControl';
import NumberInspectorControl from './controls/NumberInspectorControl';
import ToggleInspectorControl from './controls/ToggleInspectorControl';
import SelectInspectorControl from './controls/SelectInspectorControl';
import TextareaInspectorControl from './controls/TextareaInspectorControl';
import OptionsInspectorControl from './controls/OptionsInspectorControl';

/**
 * Registry mapping PHP control type names to React components.
 *
 * PHP types used in CoreFields:
 *   text     → text input
 *   textarea → multiline text
 *   number   → numeric input (supports min, max, step)
 *   checkbox → boolean toggle (PHP uses 'checkbox' for booleans)
 *   boolean  → boolean toggle (alias)
 *   toggle   → boolean toggle (alias)
 *   select   → dropdown select (requires options: [{value, label}])
 *   radio    → select fallback (renders as dropdown)
 *   options  → add/remove/edit list of choice options
 */
const CONTROL_REGISTRY = {
	text: TextInspectorControl,
	textarea: TextareaInspectorControl,
	number: NumberInspectorControl,
	checkbox: ToggleInspectorControl,
	boolean: ToggleInspectorControl,
	toggle: ToggleInspectorControl,
	select: SelectInspectorControl,
	radio: SelectInspectorControl,
	options: OptionsInspectorControl,
};

/**
 * Get the React component for a given PHP control type.
 * Falls back to TextInspectorControl for unknown types.
 *
 * @param {string} type - The control type from PHP inspectorControls
 * @returns {React.ComponentType}
 */
export function getControlComponent( type ) {
	return CONTROL_REGISTRY[ type ] ?? TextInspectorControl;
}

export default CONTROL_REGISTRY;
