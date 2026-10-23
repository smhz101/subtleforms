/**
 * The active theme's colours, fonts and button look (2.7.2).
 *
 * One request per page load, shared by every picker and by the builder canvas.
 * The server computes it (GET /subtleforms/v1/appearance/theme) and caches it
 * per theme version.
 */
import { useEffect, useState } from '@wordpress/element';
import { apiClient } from './apiClient';

let cached = null;
let pending = null;
const listeners = new Set();

/**
 * Fetch the theme data once.
 *
 * @return {Promise<Object|null>} Theme data, or null when the request fails.
 */
export function loadThemeStyles() {
  if ( cached ) {
    return Promise.resolve( cached );
  }
  if ( ! pending ) {
    pending = Promise.resolve()
      .then( () => apiClient.get( '/appearance/theme' ) )
      .then( ( data ) => {
        cached = data && typeof data === 'object' ? data : null;
        listeners.forEach( ( fn ) => fn( cached ) );
        return cached;
      } )
      .catch( () => null )
      .finally( () => {
        pending = null;
      } );
  }
  return pending;
}

/**
 * React hook: the theme data, or null until it arrives.
 *
 * @return {Object|null} Theme data.
 */
export function useThemeStyles() {
  const [ theme, setTheme ] = useState( cached );
  useEffect( () => {
    let live = true;
    const update = ( next ) => live && setTheme( next );
    listeners.add( update );
    if ( ! cached ) {
      loadThemeStyles();
    }
    return () => {
      live = false;
      listeners.delete( update );
    };
  }, [] );
  return theme;
}

/** Test helper: set or clear the data without a request. */
export function setThemeStylesForTests( data ) {
  cached = data;
  pending = null;
  listeners.forEach( ( fn ) => fn( cached ) );
}

const STYLE_FONTS = 'sf-theme-fonts';
const STYLE_VARS = 'sf-theme-vars';

/** The class the builder canvas wears so the theme's variables apply inside it. */
export const THEME_SCOPE_CLASS = 'sf-theme-scope';

/**
 * Put the theme's font files and colour variables into a document, so a form
 * drawn there can use them. The variables are limited to THEME_SCOPE_CLASS so
 * nothing else in the admin changes.
 *
 * @param {Object}   theme Theme data.
 * @param {Document} doc   Document to add to.
 */
export function injectThemeStyles( theme, doc = document ) {
  if ( ! theme || ! doc?.head ) {
    return;
  }
  const put = ( id, css ) => {
    let el = doc.getElementById( id );
    if ( ! css ) {
      el?.remove();
      return;
    }
    if ( ! el ) {
      el = doc.createElement( 'style' );
      el.id = id;
      doc.head.appendChild( el );
    }
    if ( el.textContent !== css ) {
      el.textContent = css;
    }
  };
  put( STYLE_FONTS, theme.fontFaceCss || '' );
  put( STYLE_VARS, ( theme.variablesCss || '' ).replace( /:root/g, `.${ THEME_SCOPE_CLASS }` ) );
}

/**
 * The inline style that makes a surface look like the theme's page: its font,
 * text colour and background (2.7.2).
 *
 * @param {Object|null} theme Theme data.
 * @return {Object} React style object.
 */
export function themeSurfaceStyle( theme ) {
  if ( ! theme ) {
    return {};
  }
  const style = {};
  if ( theme.bodyFont ) {
    style.fontFamily = theme.bodyFont;
  }
  if ( theme.colors?.text ) {
    style.color = theme.colors.text;
  }
  if ( theme.colors?.background ) {
    style.backgroundColor = theme.colors.background;
  }
  return style;
}
