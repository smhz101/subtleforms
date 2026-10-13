import { memo } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * PHP `chained_levels` control.
 * Each level is one dropdown: a label plus { label, value } options.
 *
 * Props (standard control interface):
 *   value    — array of { label, options: [{ label, value }] }
 *   onChange — called with the updated array
 *   label    — section heading
 *   help     — short explanation
 *   disabled — read-only mode
 */
const ChainedLevelsControl = memo( function ChainedLevelsControl( {
	value,
	onChange,
	label,
	help,
	disabled,
} ) {
	const levels = Array.isArray( value ) ? value : [];

	function updateLevel( index, nextLevel ) {
		const next = [ ...levels ];
		next[ index ] = nextLevel;
		onChange( next );
	}

	function updateOptionLabel( levelIndex, optionIndex, newLabel ) {
		const level = levels[ levelIndex ] || { label: '', options: [] };
		const options = Array.isArray( level.options ) ? [ ...level.options ] : [];
		const current = options[ optionIndex ] || {};
		options[ optionIndex ] = { ...current, label: newLabel };
		updateLevel( levelIndex, { ...level, options } );
	}

	function removeOption( levelIndex, optionIndex ) {
		const level = levels[ levelIndex ] || { label: '', options: [] };
		const options = Array.isArray( level.options ) ? [ ...level.options ] : [];
		options.splice( optionIndex, 1 );
		updateLevel( levelIndex, { ...level, options } );
	}

	function addOption( levelIndex ) {
		const level = levels[ levelIndex ] || { label: '', options: [] };
		const options = Array.isArray( level.options ) ? level.options : [];
		updateLevel( levelIndex, {
			...level,
			options: [
				...options,
				{
					label: `${ __( 'Option', 'subtleforms' ) } ${ options.length + 1 }`,
					value: `option_${ Date.now() }`,
				},
			],
		} );
	}

	function removeLevel( index ) {
		const next = [ ...levels ];
		next.splice( index, 1 );
		onChange( next );
	}

	function addLevel() {
		onChange( [ ...levels, { label: '', options: [] } ] );
	}

	return (
		<div className="sf-inspector-control sf-inspector-control--chained-levels">
			{ label && (
				<p className="sf-inspector-control__label">{ label }</p>
			) }
			{ help && (
				<p className="components-base-control__help">{ help }</p>
			) }
			{ levels.map( ( level, levelIndex ) => {
				const options = Array.isArray( level?.options ) ? level.options : [];
				return (
					<div key={ levelIndex } className="sf-inspector-control__level">
						<TextControl
							label={ __( 'Level label', 'subtleforms' ) }
							value={ level?.label || '' }
							onChange={ ( next ) => updateLevel( levelIndex, { ...level, label: next } ) }
							disabled={ disabled }
						/>
						{ options.map( ( opt, optionIndex ) => (
							<div key={ opt.value || optionIndex } className="sf-inspector-control__option-row">
								<TextControl
									value={ opt.label }
									onChange={ ( next ) => updateOptionLabel( levelIndex, optionIndex, next ) }
									disabled={ disabled }
									placeholder={ __( 'Option label', 'subtleforms' ) }
								/>
								<Button
									size="small"
									isDestructive
									disabled={ disabled }
									onClick={ () => removeOption( levelIndex, optionIndex ) }
								>
									{ '×' }
								</Button>
							</div>
						) ) }
						<Button
							variant="secondary"
							size="small"
							disabled={ disabled }
							onClick={ () => addOption( levelIndex ) }
						>
							{ __( 'Add option', 'subtleforms' ) }
						</Button>
						<Button
							variant="secondary"
							size="small"
							isDestructive
							disabled={ disabled }
							onClick={ () => removeLevel( levelIndex ) }
						>
							{ __( 'Remove level', 'subtleforms' ) }
						</Button>
					</div>
				);
			} ) }
			<Button
				variant="secondary"
				size="small"
				disabled={ disabled }
				onClick={ addLevel }
			>
				{ __( 'Add level', 'subtleforms' ) }
			</Button>
		</div>
	);
} );

export default ChainedLevelsControl;
