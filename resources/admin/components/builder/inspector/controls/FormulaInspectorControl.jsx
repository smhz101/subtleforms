import { memo, useMemo, useRef } from '@wordpress/element';
import { BaseControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useBuilder } from '../../context/BuilderContext';

const NUMERIC_TYPES = new Set( [
	'number',
	'range_slider',
	'rating',
	'scale',
	'net_promoter_score',
	'payment_amount',
	'calculation',
	'dropdown',
	'radio',
	'multiple_choice',
	'hidden',
	'text',
] );

/**
 * PHP `formula` control: a monospace formula box with one-click field chips.
 */
const FormulaInspectorControl = memo( function FormulaInspectorControl( {
	value,
	onChange,
	label,
	help,
	placeholder,
	disabled,
} ) {
	const ref = useRef( null );
	const { tree, selectedId } = useBuilder();

	const fields = useMemo( () => {
		const nodes = tree?.nodes ? Object.values( tree.nodes ) : [];
		return nodes
			.filter( ( n ) => n && n.id !== selectedId && NUMERIC_TYPES.has( n.type ) )
			.map( ( n ) => ( {
				key: n.config?.key || n.key,
				label: n.config?.label || n.label || n.config?.key,
			} ) )
			.filter( ( f ) => f.key );
	}, [ tree, selectedId ] );

	const insert = ( token ) => {
		const el = ref.current;
		const current = value || '';
		if ( ! el ) {
			onChange( `${ current }${ token }` );
			return;
		}
		const start = el.selectionStart ?? current.length;
		const end = el.selectionEnd ?? current.length;
		const next = current.slice( 0, start ) + token + current.slice( end );
		onChange( next );
		requestAnimationFrame( () => {
			el.focus();
			el.setSelectionRange( start + token.length, start + token.length );
		} );
	};

	return (
		<BaseControl
			__nextHasNoMarginBottom
			label={ label }
			help={ help }
			id="sf-formula-input"
			className="sf-formula-control">
			<textarea
				id="sf-formula-input"
				ref={ ref }
				className="sf-formula-control__input"
				rows={ 3 }
				spellCheck={ false }
				value={ value || '' }
				placeholder={ placeholder }
				disabled={ disabled }
				onChange={ ( e ) => onChange( e.target.value ) }
			/>
			{ fields.length > 0 && (
				<div className="sf-formula-control__chips" aria-label={ __( 'Insert a field', 'subtleforms' ) }>
					{ fields.map( ( f ) => (
						<button
							key={ f.key }
							type="button"
							className="sf-formula-control__chip"
							disabled={ disabled }
							title={ `{${ f.key }}` }
							onClick={ () => insert( `{${ f.key }}` ) }>
							{ f.label }
						</button>
					) ) }
				</div>
			) }
			<div className="sf-formula-control__ops">
				{ [ '+', '−', '×', '÷', '(', ')' ].map( ( op ) => (
					<button
						key={ op }
						type="button"
						className="sf-formula-control__op"
						disabled={ disabled }
						onClick={ () =>
							insert( ` ${ { '−': '-', '×': '*', '÷': '/' }[ op ] || op } ` )
						}>
						{ op }
					</button>
				) ) }
			</div>
		</BaseControl>
	);
} );

export default FormulaInspectorControl;
