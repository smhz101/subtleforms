import { memo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';

/** Seven day chips, Sunday first; the value is the list of chosen day numbers (0 is Sunday). */
const WeekdaysInspectorControl = memo( function WeekdaysInspectorControl( { value, onChange, label, help, disabled, layout, wide } ) {
	const ids = useRowIds();
	const days = [
		{ n: 0, short: __( 'Sun', 'subtleforms' ), long: __( 'Sunday', 'subtleforms' ) },
		{ n: 1, short: __( 'Mon', 'subtleforms' ), long: __( 'Monday', 'subtleforms' ) },
		{ n: 2, short: __( 'Tue', 'subtleforms' ), long: __( 'Tuesday', 'subtleforms' ) },
		{ n: 3, short: __( 'Wed', 'subtleforms' ), long: __( 'Wednesday', 'subtleforms' ) },
		{ n: 4, short: __( 'Thu', 'subtleforms' ), long: __( 'Thursday', 'subtleforms' ) },
		{ n: 5, short: __( 'Fri', 'subtleforms' ), long: __( 'Friday', 'subtleforms' ) },
		{ n: 6, short: __( 'Sat', 'subtleforms' ), long: __( 'Saturday', 'subtleforms' ) },
	];
	const chosen = Array.isArray( value ) ? value.map( Number ) : [];
	const toggle = ( n ) => {
		const next = chosen.includes( n ) ? chosen.filter( ( d ) => d !== n ) : [ ...chosen, n ];
		onChange( next.sort( ( a, b ) => a - b ) );
	};
	const chips = (
		<div
			className={ `sf-seg sf-seg--multi${ disabled ? ' is-disabled' : '' }` }
			role="group"
			aria-labelledby={ ids.labelId }
			aria-describedby={ help ? ids.helpId : undefined }
		>
			{ days.map( ( day ) => {
				const on = chosen.includes( day.n );
				return (
					<label key={ day.n } className={ `sf-seg__option${ on ? ' is-on' : '' }${ disabled ? ' is-disabled' : '' }` } title={ day.long }>
						<input
							type="checkbox"
							className="sf-seg__input"
							checked={ on }
							disabled={ disabled }
							aria-label={ day.long }
							onChange={ () => ! disabled && toggle( day.n ) }
						/>
						<span className="sf-seg__text">{ day.short }</span>
					</label>
				);
			} ) }
		</div>
	);
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } composite stacked wide={ !! wide }>
			{ chips }
		</PropertyRow>
	);
} );

export default WeekdaysInspectorControl;
