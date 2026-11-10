import { memo } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';

/**
 * Maps PHP `options` control type.
 * Renders an add/remove/edit list of { label, value } option objects.
 *
 * Props (standard control interface):
 *   value   , array of { label, value } objects
 *   onChange, called with the updated array
 *   label   , section heading
 *   disabled, read-only mode
 *   layout  , "row" draws the label as a full width row label
 */
const OptionsInspectorControl = memo( function OptionsInspectorControl( {
	value,
	onChange,
	label,
	disabled,
	layout,
} ) {
	const options = Array.isArray( value ) ? value : [];
	const ids = useRowIds();

	function updateOption( idx, newLabel ) {
		const next = [ ...options ];
		next[ idx ] = { ...next[ idx ], label: newLabel };
		onChange( next );
	}

	function removeOption( idx ) {
		const next = [ ...options ];
		next.splice( idx, 1 );
		onChange( next );
	}

	function addOption() {
		onChange( [
			...options,
			{
				label: `${ __( 'Option', 'subtleforms' ) } ${ options.length + 1 }`,
				value: `option_${ Date.now() }`,
			},
		] );
	}

	const list = (
		<>
			{ options.map( ( opt, idx ) => (
				<div key={ idx } className="sf-inspector-control__option-row">
					<TextControl
						value={ opt.label }
						onChange={ ( v ) => updateOption( idx, v ) }
						disabled={ disabled }
						placeholder={ __( 'Option label', 'subtleforms' ) }
					/>
					<Button
						size="small"
						isDestructive
						disabled={ disabled }
						onClick={ () => removeOption( idx ) }
					>
						{ '×' }
					</Button>
				</div>
			) ) }
			<Button
				variant="secondary"
				size="small"
				disabled={ disabled }
				onClick={ addOption }
			>
				{ __( '+ Add Option', 'subtleforms' ) }
			</Button>
		</>
	);

	if ( layout === 'row' ) {
		return (
			<PropertyRow label={ label } ids={ ids } composite wide>
				<div className="sf-inspector-control sf-inspector-control--options" role="group" aria-labelledby={ ids.labelId }>
					{ list }
				</div>
			</PropertyRow>
		);
	}

	return (
		<div className="sf-inspector-control sf-inspector-control--options">
			{ label && (
				<p className="sf-inspector-control__label">{ label }</p>
			) }
			{ list }
		</div>
	);
} );

export default OptionsInspectorControl;
