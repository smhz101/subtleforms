import { memo } from '@wordpress/element';
import PropertyRow, { useRowIds } from '../PropertyRow';

/** A time limit, stored as 24-hour H:i. */
const TimeInspectorControl = memo( function TimeInspectorControl( { value, onChange, label, help, disabled, layout, wide } ) {
	const ids = useRowIds();
	const input = (
		<input
			type="time"
			id={ ids.id }
			className="sf-prow__input"
			value={ value ?? '' }
			disabled={ disabled }
			aria-describedby={ help ? ids.helpId : undefined }
			onChange={ ( event ) => onChange( event.target.value ) }
		/>
	);
	if ( layout !== 'row' ) {
		return (
			<div className="sf-time-control">
				<label htmlFor={ ids.id }>{ label }</label>
				{ input }
				{ help ? <p id={ ids.helpId }>{ help }</p> : null }
			</div>
		);
	}
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } stacked wide={ !! wide }>
			{ input }
		</PropertyRow>
	);
} );

export default TimeInspectorControl;
