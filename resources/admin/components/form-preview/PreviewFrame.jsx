import {
  useState,
  useRef,
  useEffect,
  createPortal,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Renders children inside an iframe using the public form stylesheet.
 *
 * The builder preview exists to answer one question, what will a visitor see?
 * Rendering the real frontend components in the admin document cannot answer
 * that honestly: the admin stylesheet is loaded, the public one is not, and the
 * two share a `subtleforms-` class prefix, so rules collide in both directions.
 *
 * An iframe gives the preview its own document with only the frontend styles in
 * it, which makes "preview matches production" a property of the setup rather
 * than something that has to be maintained by hand.
 */
export default function PreviewFrame( { children, title, className } ) {
  const iframeRef = useRef( null );
  const [ mountNode, setMountNode ] = useState( null );
  const [ height, setHeight ] = useState( 320 );

  // Populate the iframe document once it exists, then hand React a mount point.
  useEffect( () => {
    const iframe = iframeRef.current;
    if ( ! iframe ) {
      return undefined;
    }

    const doc = iframe.contentDocument;
    if ( ! doc ) {
      return undefined;
    }

    doc.open();
    doc.write( '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' );
    doc.close();

    const themeHrefs = window.subtleformsAdmin?.themeStylesheets ?? [];
    themeHrefs.forEach( ( href ) => {
      if ( ! href ) {
        return;
      }
      const theme = doc.createElement( 'link' );
      theme.rel = 'stylesheet';
      theme.href = href;
      doc.head.appendChild( theme );
    } );

    const themeFonts = window.subtleformsAdmin?.themeFontFaces;
    if ( themeFonts ) {
      const faces = doc.createElement( 'style' );
      faces.textContent = themeFonts;
      doc.head.appendChild( faces );
    }

    const themeCss = window.subtleformsAdmin?.themeGlobalCss;
    if ( themeCss ) {
      const globals = doc.createElement( 'style' );
      globals.textContent = themeCss;
      doc.head.appendChild( globals );
    }

    const styles = window.subtleformsAdmin?.frontendStyles ?? [];
    styles.forEach( ( href ) => {
      const link = doc.createElement( 'link' );
      link.rel = 'stylesheet';
      link.href = href;
      doc.head.appendChild( link );
    } );

    // Theme type wins when the theme publishes it. Otherwise stay off Times.
    const base = doc.createElement( 'style' );
    base.textContent =
      'html,body{margin:0;padding:16px;background:transparent;' +
      'font-family:var(--wp--preset--font-family--body,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif);}';
    doc.head.appendChild( base );

    const container = doc.createElement( 'div' );
    doc.body.appendChild( container );
    setMountNode( container );

    return () => {
      setMountNode( null );
    };
  }, [] );

  // Grow the frame to its content so the preview never scrolls independently.
  useEffect( () => {
    if ( ! mountNode ) {
      return undefined;
    }

    const measure = () => {
      const next = mountNode.ownerDocument?.body?.scrollHeight ?? 0;
      if ( next > 0 ) {
        setHeight( next + 32 );
      }
    };

    measure();

    const view = mountNode.ownerDocument?.defaultView;
    const Observer = view?.ResizeObserver ?? window.ResizeObserver;

    if ( ! Observer ) {
      return undefined;
    }

    const observer = new Observer( measure );
    observer.observe( mountNode );
    return () => observer.disconnect();
  }, [ mountNode, children ] );

  return (
    <iframe
      ref={ iframeRef }
      className={ className }
      title={ title || __( 'Form preview', 'subtleforms' ) }
      style={ { width: '100%', height: `${ height }px`, border: 0, display: 'block' } }>
      { mountNode && createPortal( children, mountNode ) }
    </iframe>
  );
}
