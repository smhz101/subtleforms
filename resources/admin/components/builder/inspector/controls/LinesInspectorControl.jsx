import { memo, useState, useEffect } from '@wordpress/element';
import { TextareaControl } from '@wordpress/components';

/**
 * PHP `lines` control: an array of strings edited one per line.
 * Used for matrix rows and columns.
 */
const LinesInspectorControl = memo( function LinesInspectorControl( {
	value,
	onChange,
	label,
	help,
	disabled,
} ) {
	const toText = ( v ) =>
		Array.isArray( v )
			? v.map( ( item ) => ( typeof item === 'object' ? item?.label ?? '' : item ) ).join( '\n' )
			: '';
	const [ text, setText ] = useState( toText( value ) );

	useEffect( () => {
		setText( toText( value ) );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ JSON.stringify( value ) ] );

	return (
		<TextareaControl
			__nextHasNoMarginBottom
			label={ label }
			help={ help }
			rows={ 4 }
			value={ text }
			disabled={ disabled }
			onChange={ ( next ) => {
				setText( next );
				onChange(
					next
						.split( '\n' )
						.map( ( line ) => line.trim() )
						.filter( Boolean )
				);
			} }
		/>
	);
} );

export default LinesInspectorControl;
