/**
 * A short list of choices drawn as pills, one of them selected. Real radio
 * inputs, so the arrow keys, the group name and the focus order are the
 * browser's own.
 */
import { useId } from '@wordpress/element';

/**
 * @param {Object}   props
 * @param {Array}    props.options    [{ value, label, short?, title? }]. `short` is drawn when set; `label` stays the accessible name.
 * @param {string}   props.value      Selected value.
 * @param {Function} props.onChange   Called with the chosen value.
 * @param {string}   props.labelId    Id of the element that names the group.
 * @param {string}   props.ariaLabel  Name of the group when there is no label element.
 * @param {boolean}  props.disabled   Read only.
 * @param {string}   props.className  Extra class names.
 */
export default function Segmented( { options, value, onChange, labelId, ariaLabel, disabled = false, className = '' } ) {
	const name = `sf-seg-${ useId().replace( /:/g, '' ) }`;
	const current = String( value ?? '' );
	return (
		<div
			className={ `sf-seg${ className ? ` ${ className }` : '' }` }
			role="radiogroup"
			aria-labelledby={ labelId }
			aria-label={ labelId ? undefined : ariaLabel }
		>
			{ options.map( ( option ) => {
				const checked = String( option.value ?? '' ) === current;
				return (
					<label
						key={ String( option.value ?? '' ) || 'empty' }
						className={ `sf-seg__option${ checked ? ' is-on' : '' }${ disabled ? ' is-disabled' : '' }` }
						title={ option.title || undefined }
					>
						<input
							type="radio"
							className="sf-seg__input"
							name={ name }
							value={ option.value ?? '' }
							checked={ checked }
							disabled={ disabled }
							aria-label={ option.short ? option.label : undefined }
							onChange={ () => onChange( option.value ) }
						/>
						<span className="sf-seg__text">{ option.short || option.label }</span>
					</label>
				);
			} ) }
		</div>
	);
}

/** Whether a list of options is short enough to be drawn as pills. */
export function fitsSegmented( options ) {
	const list = Array.isArray( options ) ? options : [];
	if ( list.length < 2 || list.length > 4 ) {
		return false;
	}
	const chars = list.reduce( ( n, o ) => n + String( o.short || o.label || '' ).length, 0 );
	return chars <= 24;
}
