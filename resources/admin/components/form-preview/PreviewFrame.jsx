import {
  useState,
  useRef,
  useEffect,
  useMemo,
  createPortal,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useThemeAssets, fallbackThemeAssets } from '../../data/themeAssets';

/**
 * Renders children inside an iframe that loads what a page of the active theme
 * loads, then the public form stylesheet.
 *
 * The builder preview exists to answer one question, what will a visitor see?
 * Rendering the real frontend components in the admin document cannot answer
 * that honestly: the admin stylesheet is loaded, the public one is not, and the
 * two share a `subtleforms-` class prefix, so rules collide in both directions.
 *
 * An iframe gives the preview its own document with only the theme and
 * frontend styles in it, which makes "preview matches production" a property
 * of the setup rather than something that has to be maintained by hand. The
 * theme's own stylesheets, inline styles, fonts and global styles come from
 * the server (see ThemePreviewAssets), and the form sits in the same wrappers
 * and classes a theme page puts around page content, so the theme's content
 * width, padding and type apply to it.
 *
 * The plugin's stylesheet loads after the theme's, as on the site, so its
 * defaults win wherever a form is not inheriting.
 */

/** The page around the form, for the Light and Dark canvas switch. */
export const SCHEMES = {
  light: { background: '#ffffff', color: '#1f2937' },
  dark: { background: '#1f1f1f', color: '#e5e7eb' },
};

/** CSS for the page around the form. It never reaches the form's own tokens. */
export function schemeCss( scheme ) {
  const s = SCHEMES[ scheme ] || SCHEMES.light;
  if ( scheme === 'dark' ) {
    return `html{background:${ s.background };color:${ s.color };color-scheme:dark}body{background:transparent!important;color:inherit!important}`;
  }
  return `html{background:${ s.background };color:${ s.color }}`;
}

/** Longest wait for the theme's stylesheets before the preview settles its padding. */
const SETTLE_MS = 2500;

const PLUGIN_ATTR = 'data-sf-plugin-css';

/**
 * Put the plugin's CSS in the frame, before the scheme rule, replacing what
 * was there. The key makes a repeat call with the same choice a no-op, so the
 * frame is not repainted for nothing.
 */
function applyPluginCss( doc, plain, conversational, addLink, picker = false ) {
  const admin = window.subtleformsAdmin || {};
  const plan = pluginCssPlan( plain, conversational, admin, picker );
  const key = JSON.stringify( plan );
  if ( doc.documentElement.getAttribute( 'data-sf-plugin-key' ) === key ) {
    return;
  }
  doc.documentElement.setAttribute( 'data-sf-plugin-key', key );
  doc.head.querySelectorAll( `[${ PLUGIN_ATTR }]` ).forEach( ( node ) => node.remove() );
  const before = doc.getElementById( 'sf-preview-scheme' );
  plan.forEach( ( item ) => {
    let node;
    if ( item.kind === 'style' ) {
      node = doc.createElement( 'style' );
      node.textContent = item.value;
    } else {
      node = doc.createElement( 'link' );
      node.rel = 'stylesheet';
      node.href = item.value;
      if ( addLink ) {
        addLink.watch( node );
      }
    }
    node.setAttribute( PLUGIN_ATTR, '' );
    doc.head.insertBefore( node, before );
  } );
}

function addStyle( doc, css, id ) {
  if ( ! css ) {
    return null;
  }
  const el = doc.createElement( 'style' );
  if ( id ) {
    el.id = id;
  }
  el.textContent = css;
  doc.head.appendChild( el );
  return el;
}

/**
 * Which plugin CSS the page would print for this form, as a list of nodes.
 *
 * A form that inherits the theme untouched gets only the layout lines the
 * frontend inlines (FrontendAssets::layoutCss()); every other form gets the
 * full stylesheet. The conversational layout's file styles every submit button,
 * so only a conversational form gets it, as on the site (2.7.2).
 *
 * @param {boolean} plain          The page prints only the layout lines.
 * @param {boolean} conversational Conversational form.
 * @param {Object}  admin          window.subtleformsAdmin.
 * @param {boolean} picker         The form has a picker, which the page styles
 *                                 with picker.css whichever look the form has
 *                                 (2.9.0).
 * @return {{kind: string, value: string}[]} Nodes to add, in order.
 */
export function pluginCssPlan( plain, conversational, admin = {}, picker = false ) {
  const extra = picker && admin.pickerCss ? [ { kind: 'link', value: admin.pickerCss } ] : [];
  if ( plain && admin.layoutCss ) {
    return [ { kind: 'style', value: admin.layoutCss }, ...extra ];
  }
  return [
    ...( admin.frontendStyles ?? [] )
      .filter( ( href ) => conversational || ! /conversational\.css/.test( href ) )
      .map( ( href ) => ( { kind: 'link', value: href } ) ),
    ...extra,
  ];
}

export default function PreviewFrame( { children, title, className, conversational = false, plain = false, picker = false, scheme = 'light' } ) {
  const iframeRef = useRef( null );
  const [ mountNode, setMountNode ] = useState( null );
  const [ height, setHeight ] = useState( 320 );
  const data = useThemeAssets();
  const assets = useMemo( () => data || fallbackThemeAssets(), [ data ] );
  const schemeRef = useRef( scheme );
  schemeRef.current = scheme;
  const plainRef = useRef( plain );
  plainRef.current = plain;
  const pickerRef = useRef( picker );
  pickerRef.current = picker;

  // Populate the iframe document once it exists, then hand React a mount point.
  // It is built again when the theme's data arrives after the fallback.
  useEffect( () => {
    const iframe = iframeRef.current;
    if ( ! iframe ) {
      return undefined;
    }

    const doc = iframe.contentDocument;
    if ( ! doc ) {
      return undefined;
    }

    const bodyClass = ( assets.bodyClasses || [] ).join( ' ' );
    doc.open();
    doc.write( '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' );
    doc.close();

    const pending = new Set();
    let settled = false;
    let timer = 0;
    const settle = () => {
      if ( settled ) {
        return;
      }
      settled = true;
      window.clearTimeout( timer );
      // The theme's own padding wins. A theme that gives the page none leaves
      // the form against the frame's edge, so it gets the 16px it had before.
      const view = doc.defaultView;
      if ( ! view || ! doc.body ) {
        return;
      }
      const read = ( el, side ) => parseFloat( view.getComputedStyle( el )[ side ] ) || 0;
      const content = doc.body.querySelector( '[data-sf-content]' ) || doc.body;
      const total =
        read( doc.body, 'paddingLeft' ) +
        read( doc.body, 'marginLeft' ) +
        read( content, 'paddingLeft' ) +
        read( content, 'marginLeft' );
      if ( total === 0 ) {
        addStyle( doc, 'body{padding:16px}', 'sf-preview-pad' );
      }
    };
    const watch = ( link ) => {
      pending.add( link );
      const done = () => {
        pending.delete( link );
        if ( pending.size === 0 ) {
          settle();
        }
      };
      link.addEventListener( 'load', done );
      link.addEventListener( 'error', done );
    };
    const addLink = ( href ) => {
      if ( ! href ) {
        return;
      }
      const link = doc.createElement( 'link' );
      link.rel = 'stylesheet';
      link.href = href;
      watch( link );
      doc.head.appendChild( link );
    };
    addLink.watch = watch;

    ( assets.stylesheets || [] ).forEach( addLink );
    addStyle( doc, assets.fontFaces );
    addStyle( doc, assets.globalCss );
    addStyle( doc, assets.inlineCss );

    // Added before the scheme rule so the page around the form stays last.
    addStyle( doc, schemeCss( schemeRef.current ), 'sf-preview-scheme' );
    applyPluginCss( doc, plainRef.current, conversational, addLink, pickerRef.current );


    // The wrappers a theme's templates put around page content.
    doc.body.className = bodyClass;
    let container;
    if ( assets.isBlockTheme ) {
      const site = doc.createElement( 'div' );
      site.className = 'wp-site-blocks';
      const main = doc.createElement( 'main' );
      main.className = `wp-block-group ${ assets.contentClass || '' }`.trim();
      main.setAttribute( 'data-sf-content', '' );
      container = doc.createElement( 'div' );
      main.appendChild( container );
      site.appendChild( main );
      doc.body.appendChild( site );
    } else {
      const wrap = doc.createElement( 'div' );
      wrap.id = 'content';
      wrap.className = 'site-content';
      const article = doc.createElement( 'article' );
      article.className = 'page type-page';
      const entry = doc.createElement( 'div' );
      entry.className = assets.contentClass || 'entry-content';
      entry.setAttribute( 'data-sf-content', '' );
      container = doc.createElement( 'div' );
      entry.appendChild( container );
      article.appendChild( entry );
      wrap.appendChild( article );
      doc.body.appendChild( wrap );
    }
    setMountNode( container );

    if ( pending.size === 0 ) {
      settle();
    } else {
      timer = window.setTimeout( settle, SETTLE_MS );
    }

    return () => {
      window.clearTimeout( timer );
      settled = true;
      setMountNode( null );
    };
  }, [ assets, conversational ] );

  // Another preset: swap the plugin CSS in place, no rebuild of the frame.
  useEffect( () => {
    const doc = iframeRef.current?.contentDocument;
    if ( doc && doc.head && doc.getElementById( 'sf-preview-scheme' ) ) {
      applyPluginCss( doc, plain, conversational, null, picker );
    }
  }, [ plain, picker, conversational, mountNode ] );

  // Light or Dark page around the form: only the frame's own root changes.
  useEffect( () => {
    const doc = iframeRef.current?.contentDocument;
    const el = doc?.getElementById( 'sf-preview-scheme' );
    if ( el ) {
      el.textContent = schemeCss( scheme );
    }
  }, [ scheme, mountNode ] );

  // Grow the frame to its content so the preview never scrolls independently.
  useEffect( () => {
    if ( ! mountNode ) {
      return undefined;
    }

    const doc = mountNode.ownerDocument;
    const measure = () => {
      const body = doc?.body;
      const view = doc?.defaultView;
      if ( ! body || ! view ) {
        return;
      }
      const cs = view.getComputedStyle( body );
      const next = Math.ceil(
        body.getBoundingClientRect().height + ( parseFloat( cs.marginTop ) || 0 ) + ( parseFloat( cs.marginBottom ) || 0 )
      );
      if ( next > 0 ) {
        setHeight( next );
      }
    };

    measure();

    const view = doc?.defaultView;
    const Observer = view?.ResizeObserver ?? window.ResizeObserver;

    if ( ! Observer ) {
      return undefined;
    }

    const observer = new Observer( measure );
    observer.observe( mountNode );
    observer.observe( doc.body );
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
