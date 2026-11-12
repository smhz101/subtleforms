import { memo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function todayIso() {
	const now = new Date();
	const pad = ( n ) => String( n ).padStart( 2, '0' );
	return `${ now.getFullYear() }-${ pad( now.getMonth() + 1 ) }-${ pad( now.getDate() ) }`;
}

/**
 * A date limit: a calendar date, or a relative expression such as `today` or
 * `+7 days`. A link under the value switches between the two. The setting is
 * stored as typed, so the server and the form read the same text.
 */
const DateInspectorControl = memo( function DateInspectorControl( { value, onChange, label, help, disabled, layout, wide } ) {
	const ids = useRowIds();
	const text = value ?? '';
	const relative = text !== '' && ! ISO.test( text );
	const toggle = (
		<button
			type="button"
			className="sf-prow__link"
			disabled={ disabled }
			onClick={ () => onChange( relative ? todayIso() : 'today' ) }
		>
			{ relative ? __( 'Pick a date', 'subtleforms' ) : __( 'Use a relative date', 'subtleforms' ) }
		</button>
	);
	const input = relative ? (
		<input
			type="text"
			id={ ids.id }
			className="sf-prow__input"
			value={ text }
			placeholder="+7 days"
			disabled={ disabled }
			aria-describedby={ help ? ids.helpId : undefined }
			onChange={ ( event ) => onChange( event.target.value ) }
		/>
	) : (
		<input
			type="date"
			id={ ids.id }
			className="sf-prow__input"
			value={ text }
			disabled={ disabled }
			aria-describedby={ help ? ids.helpId : undefined }
			onChange={ ( event ) => onChange( event.target.value ) }
		/>
	);
	if ( layout !== 'row' ) {
		return (
			<div className="sf-date-control">
				<label htmlFor={ ids.id }>{ label }</label>
				{ input }
				{ toggle }
				{ help ? <p id={ ids.helpId }>{ help }</p> : null }
			</div>
		);
	}
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } stacked wide={ !! wide }>
			{ input }
			{ toggle }
		</PropertyRow>
	);
} );

export default DateInspectorControl;
