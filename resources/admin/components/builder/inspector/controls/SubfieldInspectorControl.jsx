import { useState, memo } from '@wordpress/element';
import { ToggleControl, TextControl } from '@wordpress/components';
import Icon from '../../../../components/ui/Icon';
import './SubfieldInspectorControl.scss';

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
 *   value     {Object}  — the `fields` object from config:
 *                         { key: { enabled, label, placeholder }, ... }
 *   onChange  {Function} — (newFields: Object) => void
 *   subfields {Array}   — from PHP ctrl.subfields:
 *                         [{ key, label, toggleable }]
 *   disabled  {boolean}
 */
const SubfieldInspectorControl = memo( function SubfieldInspectorControl( {
	value,
	onChange,
	subfields = [],
	disabled,
} ) {
	const [ expanded, setExpanded ] = useState( {} );

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
		<div className='sf-subfield-ctrl'>
			{ subfields.map( ( sf ) => {
				const sub    = getSub( sf.key );
				const isOpen = !! expanded[ sf.key ];

				return (
					<div
						key={ sf.key }
						className={ `sf-subfield-ctrl__row${ sub.enabled ? '' : ' sf-subfield-ctrl__row--off' }` }
					>
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
								<Icon.ChevronDown size={ 13 } />
							</button>
						</div>

						{ isOpen && (
							<div className='sf-subfield-ctrl__body'>
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
							</div>
						) }
					</div>
				);
			} ) }
		</div>
	);
} );

export default SubfieldInspectorControl;
