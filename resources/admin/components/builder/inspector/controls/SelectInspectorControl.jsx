import { memo } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';
import PropertyRow, { useRowIds } from '../PropertyRow';
import Segmented, { fitsSegmented } from './Segmented';
import ChipSelect from './ChipSelect';

/**
 * Select setting. In a row, two to four short choices are pills (a radio
 * group) and anything longer is a native select drawn as a chip.
 */
const SelectInspectorControl = memo( function SelectInspectorControl( {
	value,
	onChange,
	label,
	help,
	options = [],
	disabled,
	layout,
	wide,
} ) {
	const ids = useRowIds();
	if ( layout !== 'row' ) {
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
	}
	const pills = fitsSegmented( options );
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } composite={ pills } stacked={ ! pills } wide={ !! wide }>
			{ pills ? (
				<Segmented
					options={ options }
					value={ value ?? '' }
					onChange={ onChange }
					labelId={ ids.labelId }
					disabled={ disabled }
				/>
			) : (
				<ChipSelect
					id={ ids.id }
					options={ options }
					value={ value ?? '' }
					onChange={ onChange }
					helpId={ help ? ids.helpId : undefined }
					disabled={ disabled }
				/>
			) }
		</PropertyRow>
	);
} );

export default SelectInspectorControl;
