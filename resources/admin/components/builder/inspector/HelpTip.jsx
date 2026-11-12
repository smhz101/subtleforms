/**
 * A 16px info button that shows a setting's help text in a tooltip.
 *
 * Hover shows it after 300ms, focus shows it at once, Escape closes it. The
 * tooltip is placed above the button, or below when there is no room, and is
 * at most 240px wide. The text is shown exactly as the definition gives it.
 * The control it belongs to points at a visually hidden copy of the same
 * text (see PropertyRow), so a screen reader gets it without hovering.
 */
import { createPortal, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';

const HOVER_DELAY = 300;
const GAP = 8;
const EDGE = 8;

export default function HelpTip( { label, help } ) {
	const tipId = `sf-tip-${ useId().replace( /:/g, '' ) }`;
	const buttonRef = useRef( null );
	const tipRef = useRef( null );
	const timer = useRef( 0 );
	const [ open, setOpen ] = useState( false );
	const [ place, setPlace ] = useState( null );

	const show = useCallback( ( delay ) => {
		window.clearTimeout( timer.current );
		if ( delay ) {
			timer.current = window.setTimeout( () => setOpen( true ), delay );
		} else {
			setOpen( true );
		}
	}, [] );

	const hide = useCallback( () => {
		window.clearTimeout( timer.current );
		setOpen( false );
		setPlace( null );
	}, [] );

	useEffect( () => () => window.clearTimeout( timer.current ), [] );

	// Place the tooltip once it is drawn and its size is known.
	useLayoutEffect( () => {
		if ( ! open || ! buttonRef.current || ! tipRef.current ) {
			return;
		}
		const anchor = buttonRef.current.getBoundingClientRect();
		const tip = tipRef.current.getBoundingClientRect();
		const above = anchor.top - tip.height - GAP >= EDGE;
		const centered = anchor.left + anchor.width / 2 - tip.width / 2;
		const left = Math.max( EDGE, Math.min( centered, window.innerWidth - tip.width - EDGE ) );
		const top = above ? anchor.top - tip.height - GAP : anchor.bottom + GAP;
		setPlace( { left, top, below: ! above } );
	}, [ open, help ] );

	// A tooltip drawn on the page does not follow a scroll or a resize.
	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}
		window.addEventListener( 'scroll', hide, true );
		window.addEventListener( 'resize', hide );
		return () => {
			window.removeEventListener( 'scroll', hide, true );
			window.removeEventListener( 'resize', hide );
		};
	}, [ open, hide ] );

	if ( ! help ) {
		return null;
	}

	const onKeyDown = ( event ) => {
		if ( event.key === 'Escape' && open ) {
			// Close the tooltip only: Escape on the canvas deselects the field.
			event.stopPropagation();
			hide();
		}
	};

	const tooltip = (
		<div
			ref={ tipRef }
			id={ tipId }
			role="tooltip"
			className={ `sf-help-tip${ place ? ' is-in' : '' }${ place?.below ? ' is-below' : '' }` }
			style={ place ? { left: place.left, top: place.top } : { left: 0, top: 0 } }
		>
			{ help }
		</div>
	);

	return (
		<>
			<button
				ref={ buttonRef }
				type="button"
				className="sf-help"
				aria-label={ sprintf(
					/* translators: %s: name of a setting */
					__( 'About %s', 'subtleforms' ),
					label
				) }
				aria-describedby={ open ? tipId : undefined }
				onMouseEnter={ () => show( HOVER_DELAY ) }
				onMouseLeave={ hide }
				onFocus={ () => show( 0 ) }
				onBlur={ hide }
				onKeyDown={ onKeyDown }
			>
				<Icon.Info size={ 16 } />
			</button>
			{ open ? createPortal( tooltip, document.body ) : null }
		</>
	);
}
