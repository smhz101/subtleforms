/**
 * Colour maths for the contrast warning (2.7.2).
 *
 * Pure functions so the builder can check a pair of colours without touching
 * the page. Colours the theme names (var(--wp--preset--color--slug)) are
 * looked up in the theme palette the server sent.
 */

export const MIN_CONTRAST = 4.5;

const clamp = ( n, min, max ) => Math.min( max, Math.max( min, n ) );

/**
 * Read a colour written as hex, rgb(a) or hsl(a).
 *
 * @param {string} value CSS colour.
 * @return {{r:number,g:number,b:number,a:number}|null} Colour, or null when unreadable.
 */
export function parseColor( value ) {
  if ( typeof value !== 'string' ) {
    return null;
  }
  const text = value.trim().toLowerCase();
  if ( text === 'transparent' ) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  let m = text.match( /^#([0-9a-f]{3,8})$/ );
  if ( m ) {
    let hex = m[ 1 ];
    if ( hex.length === 3 || hex.length === 4 ) {
      hex = hex.split( '' ).map( ( c ) => c + c ).join( '' );
    }
    if ( hex.length !== 6 && hex.length !== 8 ) {
      return null;
    }
    return {
      r: parseInt( hex.slice( 0, 2 ), 16 ),
      g: parseInt( hex.slice( 2, 4 ), 16 ),
      b: parseInt( hex.slice( 4, 6 ), 16 ),
      a: hex.length === 8 ? parseInt( hex.slice( 6, 8 ), 16 ) / 255 : 1,
    };
  }
  m = text.match( /^(rgba?|hsla?)\(([^)]+)\)$/ );
  if ( ! m ) {
    return null;
  }
  const parts = m[ 2 ].split( /[\s,/]+/ ).filter( Boolean );
  if ( parts.length < 3 ) {
    return null;
  }
  const num = ( p, scale = 1 ) => ( p.endsWith( '%' ) ? ( parseFloat( p ) / 100 ) * scale : parseFloat( p ) );
  const alpha = parts[ 3 ] !== undefined ? clamp( num( parts[ 3 ], 1 ), 0, 1 ) : 1;
  if ( m[ 1 ].startsWith( 'rgb' ) ) {
    const rgb = parts.slice( 0, 3 ).map( ( p ) => clamp( Math.round( num( p, 255 ) ), 0, 255 ) );
    return rgb.some( Number.isNaN ) ? null : { r: rgb[ 0 ], g: rgb[ 1 ], b: rgb[ 2 ], a: alpha };
  }
  const h = ( ( parseFloat( parts[ 0 ] ) % 360 ) + 360 ) % 360;
  const s = clamp( parseFloat( parts[ 1 ] ) / 100, 0, 1 );
  const l = clamp( parseFloat( parts[ 2 ] ) / 100, 0, 1 );
  if ( [ h, s, l ].some( Number.isNaN ) ) {
    return null;
  }
  const f = ( n ) => {
    const k = ( n + h / 30 ) % 12;
    return l - s * Math.min( l, 1 - l ) * Math.max( -1, Math.min( k - 3, 9 - k, 1 ) );
  };
  return { r: Math.round( f( 0 ) * 255 ), g: Math.round( f( 8 ) * 255 ), b: Math.round( f( 4 ) * 255 ), a: alpha };
}

/** Relative luminance of an opaque colour (WCAG 2.1). */
export function luminance( { r, g, b } ) {
  const channel = ( v ) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow( ( c + 0.055 ) / 1.055, 2.4 );
  };
  return 0.2126 * channel( r ) + 0.7152 * channel( g ) + 0.0722 * channel( b );
}

/** Put a translucent colour on top of an opaque one. */
export function composite( top, under ) {
  const a = top.a;
  return {
    r: Math.round( top.r * a + under.r * ( 1 - a ) ),
    g: Math.round( top.g * a + under.g * ( 1 - a ) ),
    b: Math.round( top.b * a + under.b * ( 1 - a ) ),
    a: 1,
  };
}

/**
 * Contrast ratio of text on a background, 1 to 21.
 *
 * @param {string} foreground CSS colour.
 * @param {string} background CSS colour.
 * @return {number|null} Ratio, or null when either colour cannot be read.
 */
export function contrastRatio( foreground, background ) {
  const fg = parseColor( foreground );
  const bg = parseColor( background );
  if ( ! fg || ! bg ) {
    return null;
  }
  const base = bg.a < 1 ? composite( bg, { r: 255, g: 255, b: 255, a: 1 } ) : bg;
  const top = fg.a < 1 ? composite( fg, base ) : fg;
  const light = Math.max( luminance( top ), luminance( base ) );
  const dark = Math.min( luminance( top ), luminance( base ) );
  return ( light + 0.05 ) / ( dark + 0.05 );
}
