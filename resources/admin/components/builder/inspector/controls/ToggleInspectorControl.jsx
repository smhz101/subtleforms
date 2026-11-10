import { memo } from '@wordpress/element';
import { ToggleControl } from '@wordpress/components';
import Toggle from './Toggle';
import PropertyRow, { useRowIds } from '../PropertyRow';

/**
 * Maps PHP `checkbox`, `boolean`, and `toggle` control types.
 * Renders a slide toggle for on/off boolean settings. In a row the toggle
 * is followed by a short state text when the control gives `onText` and
 * `offText`.
 */
const ToggleInspectorControl = memo( function ToggleInspectorControl( {
	value,
	onChange,
	label,
	help,
	disabled,
	layout,
	onText,
	offText,
	icon,
} ) {
	const ids = useRowIds();
	if ( layout !== 'row' ) {
		return (
			<ToggleControl
				label={ label }
				checked={ !! value }
				onChange={ onChange }
				help={ help }
				disabled={ disabled }
			/>
		);
	}
	const stateText = value ? onText : offText;
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } icon={ icon }>
			<span className="sf-prow__toggle">
				<Toggle
					id={ ids.id }
					checked={ !! value }
					disabled={ disabled }
					aria-describedby={ help ? ids.helpId : undefined }
					onChange={ ( event ) => onChange( event.target.checked ) }
				/>
				{ stateText ? <span className="sf-prow__state">{ stateText }</span> : null }
			</span>
		</PropertyRow>
	);
} );

export default ToggleInspectorControl;
