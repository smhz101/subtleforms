/**
 * A section of the field settings sheet: a small uppercase header that opens
 * and closes it, an optional text action on the right ("Paste list",
 * "+ Rule") and the settings below.
 *
 * Whether a section is open is remembered for the browser (not per field) in
 * localStorage under `sf-inspector-<id>`. Storage can be blocked or full, so
 * every read and write is guarded and the section works without it.
 */
import { useCallback, useId, useState } from '@wordpress/element';
import { ChevronGlyph } from './glyphs';

const STORAGE_PREFIX = 'sf-inspector-';

/** The saved open state of a section, or null when none is saved. */
export function readSectionOpen( id ) {
	try {
		const saved = window.localStorage.getItem( `${ STORAGE_PREFIX }${ id }` );
		if ( saved === 'open' ) return true;
		if ( saved === 'closed' ) return false;
	} catch ( e ) {
		// Storage is blocked: use the default.
	}
	return null;
}

function writeSectionOpen( id, open ) {
	try {
		window.localStorage.setItem( `${ STORAGE_PREFIX }${ id }`, open ? 'open' : 'closed' );
	} catch ( e ) {
		// Storage is blocked or full: the section still opens and closes.
	}
}

/**
 * Open state of a section: the saved one, else the default.
 *
 * @param {string}  id          Section id.
 * @param {boolean} defaultOpen Open when nothing is saved.
 * @return {[boolean, Function]} State and setter (the setter saves).
 */
export function useSectionOpen( id, defaultOpen ) {
	const [ open, setOpen ] = useState( () => readSectionOpen( id ) ?? defaultOpen );
	const set = useCallback(
		( next ) => {
			setOpen( ( current ) => {
				const value = typeof next === 'function' ? next( current ) : next;
				writeSectionOpen( id, value );
				return value;
			} );
		},
		[ id ]
	);
	return [ open, set ];
}

/**
 * @param {Object}   props
 * @param {string}   props.id          Section id: storage key, anchor and test hook.
 * @param {string}   props.title       Header text (drawn uppercase by CSS).
 * @param {boolean}  props.defaultOpen Open until the person closes it.
 * @param {Object}   props.action      { label, onClick, disabled }: text action on the right.
 * @param {*}        props.badge       Small count or mark after the title.
 * @param {Array}    props.state     [open, setOpen] from useSectionOpen(), when the parent needs to open the section (a header action, a quick row).
 * @param {*}        props.children    The settings, drawn only while the section is open.
 */
export default function InspectorSection( {
	id,
	title,
	defaultOpen = true,
	action = null,
	badge = null,
	state = null,
	children,
} ) {
	const own = useSectionOpen( id, defaultOpen );
	const [ open, setOpen ] = state || own;
	const bodyId = `sf-isec-${ useId().replace( /:/g, '' ) }`;

	return (
		<section className={ `sf-isec${ open ? ' is-open' : '' }` } data-section={ id }>
			<div className="sf-isec__head">
				<button
					type="button"
					className="sf-isec__toggle"
					aria-expanded={ open }
					aria-controls={ bodyId }
					onClick={ () => setOpen( ( current ) => ! current ) }
				>
					<span className="sf-isec__title">{ title }</span>
					{ badge ? <span className="sf-isec__badge">{ badge }</span> : null }
					<span className="sf-isec__chevron" aria-hidden="true">
						<ChevronGlyph size={ 16 } />
					</span>
				</button>
				{ action ? (
					<button
						type="button"
						className="sf-isec__action"
						disabled={ action.disabled }
						onClick={ action.onClick }
					>
						{ action.label }
					</button>
				) : null }
			</div>
			<div className="sf-isec__body" id={ bodyId } hidden={ ! open }>
				{ open ? children : null }
			</div>
		</section>
	);
}
