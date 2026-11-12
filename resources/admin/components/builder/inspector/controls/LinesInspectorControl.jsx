import { memo, useState, useEffect } from '@wordpress/element';
import { TextareaControl } from '@wordpress/components';
import PropertyRow, { useRowIds } from '../PropertyRow';

/**
 * PHP `lines` control: an array of strings edited one per line.
 * Used for matrix rows and columns. In a row layout it takes the full width
 * under its label.
 */
const LinesInspectorControl = memo( function LinesInspectorControl( {
	value,
	onChange,
	label,
	help,
	disabled,
	layout,
} ) {
	const ids = useRowIds();
	const toText = ( v ) =>
		Array.isArray( v )
			? v.map( ( item ) => ( typeof item === 'object' ? item?.label ?? '' : item ) ).join( '\n' )
			: '';
	const [ text, setText ] = useState( toText( value ) );

	useEffect( () => {
		setText( toText( value ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ JSON.stringify( value ) ] );

	const change = ( next ) => {
		setText( next );
		onChange(
			next
				.split( '\n' )
				.map( ( line ) => line.trim() )
				.filter( Boolean )
		);
	};

	if ( layout !== 'row' ) {
		return (
			<TextareaControl
				__nextHasNoMarginBottom
				label={ label }
				help={ help }
				rows={ 4 }
				value={ text }
				disabled={ disabled }
				onChange={ change }
			/>
		);
	}
	return (
		<PropertyRow label={ label } ids={ ids } help={ help } wide>
			<textarea
				id={ ids.id }
				className="sf-prow__input sf-prow__input--box"
				rows={ 4 }
				value={ text }
				disabled={ disabled }
				aria-describedby={ help ? ids.helpId : undefined }
				onChange={ ( event ) => change( event.target.value ) }
			/>
		</PropertyRow>
	);
} );

export default LinesInspectorControl;
