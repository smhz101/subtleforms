import { useState, memo } from '@wordpress/element';
import { ToggleControl, TextControl } from '@wordpress/components';
import Toggle from './Toggle';
import { __ } from '@wordpress/i18n';
import PropertyRow, { useRowIds } from '../PropertyRow';
import { ChevronGlyph } from '../glyphs';
import './SubfieldInspectorControl.scss';

/**
 * One sub-field's Label or Placeholder, as a row.
 */
function SubfieldTextRow( { label, value, placeholder, disabled, onChange } ) {
	const ids = useRowIds();
	return (
		<PropertyRow label={ label } ids={ ids }>
			<input
				type="text"
				id={ ids.id }
				className="sf-prow__input"
				value={ value }
				placeholder={ placeholder || __( 'Add…', 'subtleforms' ) }
				disabled={ disabled }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
		</PropertyRow>
	);
}

/**
 * The toggle (or fixed name) at the head of a sub-field row, in the row layout.
 */
function SubfieldHead( { sf, sub, isOpen, disabled, onToggle, onExpand } ) {
	const ids = useRowIds();
	const name = sub.label || sf.label;
	return (
		<div className="sf-subfield-ctrl__header">
			{ sf.toggleable ? (
				<>
					<Toggle
						id={ ids.id }
						checked={ sub.enabled }
						disabled={ disabled }
						onChange={ ( event ) => onToggle( event.target.checked ) }
					/>
					<label className="sf-subfield-ctrl__name" htmlFor={ ids.id }>{ name }</label>
				</>
			) : (
				<span className="sf-subfield-ctrl__fixed-label">{ name }</span>
			) }
			<button
				type="button"
				className={ `sf-subfield-ctrl__chevron${ isOpen ? ' sf-subfield-ctrl__chevron--open' : '' }` }
				onClick={ onExpand }
				aria-label={ __( 'Expand sub-field settings', 'subtleforms' ) }
			>
				<ChevronGlyph size={ 13 } />
			</button>
		</div>
	);
}

/**
 * SubfieldInspectorControl
 *
 * Inspector control type: 'subfield'
 *
 * Renders one expandable row per sub-field:
 *   - Toggle (if toggleable) or fixed label
 *   - Chevron to expand / collapse
 *   - Expanded: Label input + Placeholder input
 *
 * Props:
 *   value     {Object} , the `fields` object from config:
 *                         { key: { enabled, label, placeholder }, ... }
 *   onChange  {Function}, (newFields: Object) => void
 *   subfields {Array}  , from PHP ctrl.subfields:
 *                         [{ key, label, toggleable }]
 *   disabled  {boolean}
 *   layout    {string}  , "row" draws the rows of the settings sheet
 */
const SubfieldInspectorControl = memo( function SubfieldInspectorControl( {
	value,
	onChange,
	subfields = [],
	disabled,
	layout,
} ) {
	const [ expanded, setExpanded ] = useState( {} );
	const isRow = layout === 'row';

	/**
	 * Resolve the stored config for a sub-field key, falling back to the
	 * PHP-declared defaults from the subfields metadata.
	 */
	function getSub( key ) {
		const meta    = subfields.find( ( s ) => s.key === key ) ?? {};
		const stored  = ( value && typeof value === 'object' ) ? ( value[ key ] ?? {} ) : {};
		return {
			enabled:     stored.enabled     ?? ( meta.toggleable ? false : true ),
			label:       stored.label       ?? meta.label ?? '',
			placeholder: stored.placeholder ?? '',
		};
	}

	function updateSub( key, patch ) {
		const current = getSub( key );
		const next    = {
			...( value && typeof value === 'object' ? value : {} ),
			[ key ]: { ...current, ...patch },
		};
		onChange( next );
	}

	function toggleExpand( key ) {
		setExpanded( ( prev ) => ( { ...prev, [ key ]: ! prev[ key ] } ) );
	}

	return (
		<div className={ `sf-subfield-ctrl${ isRow ? ' sf-subfield-ctrl--row' : '' }` }>
			{ subfields.map( ( sf ) => {
				const sub    = getSub( sf.key );
				const isOpen = !! expanded[ sf.key ];

				return (
					<div
						key={ sf.key }
						className={ `sf-subfield-ctrl__row${ sub.enabled ? '' : ' sf-subfield-ctrl__row--off' }` }
					>
						{ isRow ? (
							<SubfieldHead
								sf={ sf }
								sub={ sub }
								isOpen={ isOpen }
								disabled={ disabled }
								onToggle={ ( enabled ) => updateSub( sf.key, { enabled } ) }
								onExpand={ () => toggleExpand( sf.key ) }
							/>
						) : (
							<div className='sf-subfield-ctrl__header'>
								{ sf.toggleable ? (
									<ToggleControl
										label={ sub.label || sf.label }
										checked={ sub.enabled }
										onChange={ ( val ) =>
											updateSub( sf.key, { enabled: val } )
										}
										disabled={ disabled }
									/>
								) : (
									<span className='sf-subfield-ctrl__fixed-label'>
										{ sub.label || sf.label }
									</span>
								) }
								<button
									type='button'
									className={ `sf-subfield-ctrl__chevron${ isOpen ? ' sf-subfield-ctrl__chevron--open' : '' }` }
									onClick={ () => toggleExpand( sf.key ) }
									aria-label='Expand sub-field settings'
								>
									<ChevronGlyph size={ 13 } />
								</button>
							</div>
						) }

						{ isOpen && (
							<div className='sf-subfield-ctrl__body'>
								{ isRow ? (
									<>
										<SubfieldTextRow
											label={ __( 'Label', 'subtleforms' ) }
											value={ sub.label }
											placeholder={ sf.label }
											disabled={ disabled }
											onChange={ ( val ) => updateSub( sf.key, { label: val } ) }
										/>
										<SubfieldTextRow
											label={ __( 'Placeholder', 'subtleforms' ) }
											value={ sub.placeholder }
											disabled={ disabled }
											onChange={ ( val ) => updateSub( sf.key, { placeholder: val } ) }
										/>
									</>
								) : (
									<>
										<TextControl
											label='Label'
											value={ sub.label }
											onChange={ ( val ) =>
												updateSub( sf.key, { label: val } )
											}
											placeholder={ sf.label }
											disabled={ disabled }
										/>
										<TextControl
											label='Placeholder'
											value={ sub.placeholder }
											onChange={ ( val ) =>
												updateSub( sf.key, { placeholder: val } )
											}
											disabled={ disabled }
										/>
									</>
								) }
							</div>
						) }
					</div>
				);
			} ) }
		</div>
	);
} );

export default SubfieldInspectorControl;
