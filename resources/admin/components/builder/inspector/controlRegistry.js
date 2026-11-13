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
import SubfieldInspectorControl from './controls/SubfieldInspectorControl';
import LinesInspectorControl from './controls/LinesInspectorControl';
import MaskTryControl from './controls/MaskTryControl';
import PanelSelectInspectorControl from './controls/PanelSelectInspectorControl';
import DateInspectorControl from './controls/DateInspectorControl';
import TimeInspectorControl from './controls/TimeInspectorControl';
import WeekdaysInspectorControl from './controls/WeekdaysInspectorControl';
import ChainedLevelsControl from './controls/ChainedLevelsControl';
import { getInspectorControl } from '../../../../shared/extend';

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
 *   date     → a date or a relative date such as +7 days
 *   time     → a 24-hour time
 *   weekdays → seven day chips, a list of day numbers
 *   subfield → composite sub-field config (toggle + label + placeholder per sub-field)
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
	subfield: SubfieldInspectorControl,
	lines: LinesInspectorControl,
	chained_levels: ChainedLevelsControl,
	mask_try: MaskTryControl,
	panel_select: PanelSelectInspectorControl,
	date: DateInspectorControl,
	time: TimeInspectorControl,
	weekdays: WeekdaysInspectorControl,
};

/**
 * Get the React component for a given PHP control type.
 * Falls back to TextInspectorControl for unknown types.
 *
 * @param {string} type - The control type from PHP inspectorControls
 * @returns {React.ComponentType}
 */
export function getControlComponent( type ) {
	// Controls registered by add-ons (registerInspectorControl) come first.
	return getInspectorControl( type ) ?? CONTROL_REGISTRY[ type ] ?? TextInspectorControl;
}

export default CONTROL_REGISTRY;
