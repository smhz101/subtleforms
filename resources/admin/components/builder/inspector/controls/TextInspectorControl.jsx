import { memo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';

const TextInspectorControl = memo( function TextInspectorControl( {
	value,
	onChange,
	label,
	help,
	placeholder,
	disabled,
} ) {
	return (
		<TextControl
			label={ label }
			value={ value ?? '' }
			onChange={ onChange }
			help={ help }
			placeholder={ placeholder }
			disabled={ disabled }
		/>
	);
} );

export default TextInspectorControl;
