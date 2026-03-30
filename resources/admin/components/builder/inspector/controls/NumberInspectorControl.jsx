import { memo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';

const NumberInspectorControl = memo( function NumberInspectorControl( {
	value,
	onChange,
	label,
	help,
	placeholder,
	disabled,
	min,
	max,
	step,
} ) {
	return (
		<TextControl
			label={ label }
			type="number"
			value={ value ?? '' }
			onChange={ ( raw ) => {
				if ( raw === '' || raw === null || raw === undefined ) {
					onChange( null );
					return;
				}
				const parsed = Number( raw );
				onChange( Number.isNaN( parsed ) ? null : parsed );
			} }
			help={ help }
			placeholder={ placeholder }
			disabled={ disabled }
			min={ min }
			max={ max }
			step={ step }
		/>
	);
} );

export default NumberInspectorControl;
