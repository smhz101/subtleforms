import { memo, useLayoutEffect, useRef } from '@wordpress/element';
import { TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';

const MAX_ROWS = 8;

/**
 * Multi-line text setting. In a row it starts as one line and grows with
 * its content, up to eight lines, with no resize handle.
 */
const TextareaInspectorControl = memo( function TextareaInspectorControl( {
	value,
	onChange,
	label,
	help,
	placeholder,
	disabled,
	rows,
	layout,
	wide,
} ) {
	const ids = useRowIds();
	const ref = useRef( null );

	useLayoutEffect( () => {
		const el = ref.current;
		if ( ! el || layout !== 'row' ) {
			return;
		}
		el.style.height = 'auto';
		const style = window.getComputedStyle( el );
		const line = parseFloat( style.lineHeight ) || 18;
		const pad = ( parseFloat( style.paddingTop ) || 0 ) + ( parseFloat( style.paddingBottom ) || 0 );
		const max = line * MAX_ROWS + pad;
		if ( el.scrollHeight ) {
			el.style.height = `${ Math.min( el.scrollHeight, max ) }px`;
		}
		el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
	}, [ value, layout ] );

	if ( layout !== 'row' ) {
		return (
			<TextareaControl
				label={ label }
				value={ value ?? '' }
				onChange={ onChange }
				help={ help }
				placeholder={ placeholder }
				disabled={ disabled }
				rows={ rows }
			/>
		);
	}
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } stacked wide={ !! wide }>
			<textarea
				ref={ ref }
				id={ ids.id }
				className="sf-prow__input sf-prow__input--area"
				rows={ 2 }
				value={ value ?? '' }
				placeholder={ placeholder || __( 'Add…', 'subtleforms' ) }
				disabled={ disabled }
				aria-describedby={ help ? ids.helpId : undefined }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
		</PropertyRow>
	);
} );

export default TextareaInspectorControl;
