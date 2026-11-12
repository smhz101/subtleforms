/**
 * A native select drawn as a small chip with a chevron. Used for lists of
 * five or more choices, and for lists whose labels are too long for pills.
 */
import { ChevronGlyph } from '../glyphs';

/**
 * @param {Object}   props
 * @param {string}   props.id         Id of the select, for the row label.
 * @param {Array}    props.options    [{ value, label, disabled? }].
 * @param {string}   props.value      Selected value.
 * @param {Function} props.onChange   Called with the chosen value.
 * @param {string}   props.helpId     Id of the help text, if any.
 * @param {boolean}  props.disabled   Read only.
 */
export default function ChipSelect( { id, options = [], value, onChange, helpId, disabled = false, ...rest } ) {
	return (
		<span className="sf-chip-select">
			<select
				id={ id }
				className="sf-chip-select__input"
				value={ value ?? '' }
				disabled={ disabled }
				aria-disabled={ disabled ? 'true' : undefined }
				aria-describedby={ helpId }
				onChange={ ( event ) => ! disabled && onChange( event.target.value ) }
				{ ...rest }
			>
				{ options.map( ( option ) => (
					<option key={ String( option.value ) } value={ option.value } disabled={ option.disabled }>
						{ option.label }
					</option>
				) ) }
			</select>
			<span className="sf-chip-select__chevron" aria-hidden="true">
				<ChevronGlyph size={ 12 } />
			</span>
		</span>
	);
}
