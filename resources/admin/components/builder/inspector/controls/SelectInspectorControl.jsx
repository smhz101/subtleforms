import { memo } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';

const SelectInspectorControl = memo( function SelectInspectorControl( {
	value,
	onChange,
	label,
	help,
	options = [],
	disabled,
} ) {
	return (
		<SelectControl
			label={ label }
			value={ value ?? '' }
			options={ options }
			onChange={ onChange }
			help={ help }
			disabled={ disabled }
		/>
	);
} );

export default SelectInspectorControl;
