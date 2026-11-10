import { memo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';

const parse = ( raw ) => {
	if ( raw === '' || raw === null || raw === undefined ) {
		return null;
	}
	const parsed = Number( raw );
	return Number.isNaN( parsed ) ? null : parsed;
};

/**
 * Number setting. In a row the input is 72px wide and right aligned, with
 * the unit (when the PHP control names one) in muted text after it.
 */
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
	unit,
	layout,
} ) {
	const ids = useRowIds();
	if ( layout !== 'row' ) {
		return (
			<TextControl
				label={ label }
				type="number"
				value={ value ?? '' }
				onChange={ ( raw ) => onChange( parse( raw ) ) }
				help={ help }
				placeholder={ placeholder }
				disabled={ disabled }
				min={ min }
				max={ max }
				step={ step }
			/>
		);
	}
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } stacked={ !! unit } className={ unit ? '' : 'sf-prow--field' }>
			<span className="sf-prow__number">
				<input
					type="number"
					id={ ids.id }
					className="sf-prow__input sf-prow__input--number"
					value={ value ?? '' }
					placeholder={ placeholder || __( 'Add…', 'subtleforms' ) }
					disabled={ disabled }
					min={ min }
					max={ max }
					step={ step }
					aria-describedby={ help ? ids.helpId : undefined }
					onChange={ ( event ) => onChange( parse( event.target.value ) ) }
				/>
				{ unit ? <span className="sf-prow__unit">{ unit }</span> : null }
			</span>
		</PropertyRow>
	);
} );

export default NumberInspectorControl;
