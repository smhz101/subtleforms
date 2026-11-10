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
 */
export default function InspectorTabs( { tab, onChange, idBase } ) {
	const listRef = useRef( null );
	const items = [
		{ id: 'settings', label: __( 'Field settings', 'subtleforms' ), icon: <GearGlyph /> },
		{ id: 'styles', label: __( 'Field styles', 'subtleforms' ), icon: <ContrastGlyph /> },
	];

	const onKeyDown = ( event ) => {
		const index = TABS.indexOf( tab );
		let next = null;
		if ( event.key === 'ArrowRight' ) next = TABS[ ( index + 1 ) % TABS.length ];
		if ( event.key === 'ArrowLeft' ) next = TABS[ ( index + TABS.length - 1 ) % TABS.length ];
		if ( event.key === 'Home' ) next = TABS[ 0 ];
		if ( event.key === 'End' ) next = TABS[ TABS.length - 1 ];
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
			aria-label={ __( 'Settings sections', 'subtleforms' ) }
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
