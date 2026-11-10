import { memo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';

/**
 * Text setting. With `layout="row"` the label is drawn by a property row and
 * the value is a quiet input: no border until it is hovered or focused.
 */
const TextInspectorControl = memo( function TextInspectorControl( {
	value,
	onChange,
	label,
	help,
	placeholder,
	disabled,
	layout,
	wide,
} ) {
	const ids = useRowIds();
	if ( layout !== 'row' ) {
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
	}
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } wide={ !! wide }>
			<input
				type="text"
				id={ ids.id }
				className="sf-prow__input"
				value={ value ?? '' }
				placeholder={ placeholder || __( 'Add…', 'subtleforms' ) }
				disabled={ disabled }
				aria-describedby={ help ? ids.helpId : undefined }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
		</PropertyRow>
	);
} );

export default TextInspectorControl;
