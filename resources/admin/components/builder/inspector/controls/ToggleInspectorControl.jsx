import { memo } from '@wordpress/element';
import { ToggleControl } from '@wordpress/components';

/**
 * Maps PHP `checkbox`, `boolean`, and `toggle` control types.
 * Renders a slide toggle for on/off boolean settings.
 */
const ToggleInspectorControl = memo( function ToggleInspectorControl( {
	value,
	onChange,
	label,
	help,
	disabled,
} ) {
	return (
		<ToggleControl
			label={ label }
			checked={ !! value }
			onChange={ onChange }
			help={ help }
			disabled={ disabled }
		/>
	);
} );

export default ToggleInspectorControl;
