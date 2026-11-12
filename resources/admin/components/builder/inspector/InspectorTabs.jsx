/**
 * The two icon tabs under the panel header, as the WordPress block panel has
 * them: settings (gear) and styles (half circle). They are named Field
 * settings and Field styles so that neither shares a name with the builder's
 * own Settings view (UX2-13). Icon only, with a tooltip
 * and an aria-label, an underline on the active one and a roving tabindex.
 * The active tab is remembered per browser.
 */
import { useCallback, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ContrastGlyph, GearGlyph } from './glyphs';

const STORAGE_KEY = 'sf-inspector-tab';

export const TABS = [ 'settings', 'styles' ];

/** The remembered tab, Settings when nothing is stored or storage is blocked. */
export function readInspectorTab() {
	try {
		return window.localStorage.getItem( STORAGE_KEY ) === 'styles' ? 'styles' : 'settings';
	} catch ( e ) {
		return 'settings';
	}
}

/**
 * A remembered tab for any set of tabs, for panels other than the field panel.
 *
 * @param {string}   storageKey localStorage key.
 * @param {string[]} ids        Tab ids; the first is the default.
 * @return {[string, Function]} The active tab and a setter that remembers it.
 */
export function useStoredTab( storageKey, ids ) {
	const [ tab, setTab ] = useState( () => {
		try {
			const saved = window.localStorage.getItem( storageKey );
			return ids.includes( saved ) ? saved : ids[ 0 ];
		} catch ( e ) {
			return ids[ 0 ];
		}
	} );
	const set = useCallback(
		( next ) => {
			setTab( next );
			try {
				window.localStorage.setItem( storageKey, next );
			} catch ( e ) {
				// Storage is blocked: the tab still switches.
			}
		},
		[ storageKey ]
	);
	return [ tab, set ];
}

/** @return {[string, Function]} The active tab and a setter that remembers it. */
export function useInspectorTab() {
	const [ tab, setTab ] = useState( readInspectorTab );
	const set = useCallback( ( next ) => {
		setTab( next );
		try {
			window.localStorage.setItem( STORAGE_KEY, next );
		} catch ( e ) {
			// Storage is blocked: the tab still switches.
		}
	}, [] );
	return [ tab, set ];
}

/**
 * @param {Object}   props
 * @param {string}   props.tab      Active tab id.
 * @param {Function} props.onChange Called with the new tab id.
 * @param {string}   props.idBase   Prefix for the tab and panel ids.
 * @param {Array}    props.items    [{ id, label, icon }]: other tabs than the field panel's two.
 * @param {string}   props.ariaLabel Name of the tab list.
 */
export default function InspectorTabs( { tab, onChange, idBase, items: custom, ariaLabel } ) {
	const listRef = useRef( null );
	const items = custom || [
		{ id: 'settings', label: __( 'Field settings', 'subtleforms' ), icon: <GearGlyph /> },
		{ id: 'styles', label: __( 'Field styles', 'subtleforms' ), icon: <ContrastGlyph /> },
	];
	const ids = items.map( ( item ) => item.id );

	const onKeyDown = ( event ) => {
		const index = ids.indexOf( tab );
		let next = null;
		if ( event.key === 'ArrowRight' ) next = ids[ ( index + 1 ) % ids.length ];
		if ( event.key === 'ArrowLeft' ) next = ids[ ( index + ids.length - 1 ) % ids.length ];
		if ( event.key === 'Home' ) next = ids[ 0 ];
		if ( event.key === 'End' ) next = ids[ ids.length - 1 ];
		if ( ! next ) {
			return;
		}
		event.preventDefault();
		onChange( next );
		listRef.current?.querySelector( `#${ idBase }-tab-${ next }` )?.focus();
	};

	return (
		<div
			className="sf-itabs"
			role="tablist"
			aria-label={ ariaLabel || __( 'Settings sections', 'subtleforms' ) }
			ref={ listRef }
			onKeyDown={ onKeyDown }
		>
			{ items.map( ( item ) => (
				<Button
					key={ item.id }
					id={ `${ idBase }-tab-${ item.id }` }
					className={ `sf-itabs__tab${ tab === item.id ? ' is-active' : '' }` }
					role="tab"
					aria-selected={ tab === item.id }
					aria-controls={ `${ idBase }-panel` }
					tabIndex={ tab === item.id ? 0 : -1 }
					icon={ item.icon }
					label={ item.label }
					showTooltip
					onClick={ () => onChange( item.id ) }
				/>
			) ) }
		</div>
	);
}
