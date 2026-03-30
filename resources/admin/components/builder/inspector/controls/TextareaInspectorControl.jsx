import { memo } from '@wordpress/element';
import { TextareaControl } from '@wordpress/components';

const TextareaInspectorControl = memo( function TextareaInspectorControl( {
	value,
	onChange,
	label,
	help,
	placeholder,
	disabled,
	rows,
} ) {
	return (
		<TextareaControl
			label={ label }
			value={ value ?? '' }
			onChange={ onChange }
			help={ help }
			placeholder={ placeholder }
			disabled={ disabled }
			rows={ rows }
		/>
	);
} );

export default TextareaInspectorControl;
