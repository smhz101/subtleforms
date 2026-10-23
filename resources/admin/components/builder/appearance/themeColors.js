import { TOKEN_DEFAULTS } from '../../../../shared/appearance';
import { contrastRatio, MIN_CONTRAST } from './contrast';

/**
 * Helpers that connect a form's tokens to the active theme (2.7.2).
 *
 * `theme` is the object GET /appearance/theme returns (palette, fontFamilies,
 * fontSizes, bodyFont, headingFont, colors, buttonStyles, isBlockTheme), or
 * null while it loads or when the request fails.
 */

const PRESET_COLOR = /^var\(--wp--preset--color--([a-z0-9-]+)\)$/;

/** The CSS variable that names a palette colour. */
export const paletteVar = ( slug ) => `var(--wp--preset--color--${ slug })`;

/** The CSS variable that names a theme font family. */
export const fontVar = ( slug ) => `var(--wp--preset--font-family--${ slug })`;

/** The CSS variable that names a theme font size. */
export const sizeVar = ( slug ) => `var(--wp--preset--font-size--${ slug })`;

/**
 * Turn a stored colour into a plain colour when it names a palette entry.
 *
 * @param {string}      value Stored token value.
 * @param {Object|null} theme Theme data.
 * @return {string} A colour the maths can read, or the value as it was.
 */
export function resolveThemeColor( value, theme ) {
  if ( typeof value !== 'string' ) {
    return '';
  }
  const m = value.match( PRESET_COLOR );
  if ( ! m ) {
    return value;
  }
  const found = ( theme?.palette || [] ).find( ( c ) => c.slug === m[ 1 ] );
  return found ? found.color : '';
}

/**
 * Same as resolveThemeColor() but also follows a theme style that points at a
 * palette colour (theme.json colours are often var(--wp--preset--color--x)).
 */
const themeColor = ( value, theme ) => resolveThemeColor( value || '', theme );

/**
 * What a token shows when the form does not set it. A theme form gets the
 * theme's own value; any other form gets the plugin default.
 *
 * @param {string}      key        Token key.
 * @param {Object}      appearance metadata.appearance
 * @param {Object|null} theme      Theme data.
 * @return {string} Colour, font or ''.
 */
export function inheritedValue( key, appearance, theme ) {
  const isTheme = appearance?.preset === 'theme';
  const tokens = appearance?.tokens || {};
  const own = ( k ) => tokens[ k ] || '';
  if ( isTheme && theme ) {
    const text = theme.colors?.text;
    const map = {
      colorText: text,
      colorLabel: own( 'colorText' ) || text,
      colorInputText: own( 'colorText' ) || text,
      colorBackground: theme.colors?.background,
      colorLink: theme.colors?.link,
      colorPrimary: theme.buttonStyles?.background,
      colorPrimaryHover: own( 'colorPrimary' ) || theme.buttonStyles?.background,
      colorButtonText: theme.buttonStyles?.text,
      fontFamily: theme.bodyFont,
      labelFont: own( 'fontFamily' ) || theme.bodyFont,
      inputFont: own( 'fontFamily' ) || theme.bodyFont,
      buttonRadius: theme.buttonStyles?.radius,
    };
    if ( map[ key ] ) {
      return map[ key ];
    }
  }
  if ( key === 'colorLabel' || key === 'colorInputText' ) {
    return own( 'colorText' ) || TOKEN_DEFAULTS.colorText;
  }
  if ( key === 'colorFocusRing' ) {
    return own( 'colorFocus' ) || own( 'colorPrimary' ) || TOKEN_DEFAULTS.colorPrimary;
  }
  return TOKEN_DEFAULTS[ key ] || '';
}

/**
 * Pairs of colours that are hard to read, for the contrast warning.
 *
 * Only forms whose colours are set are checked: a theme form nobody has
 * touched is the theme's own choice.
 *
 * @param {Object}      appearance metadata.appearance
 * @param {Object|null} theme      Theme data.
 * @return {Array<{id:string,ratio:number}>} Failing pairs.
 */
export function contrastIssues( appearance, theme ) {
  const tokens = appearance?.tokens || {};
  const touched = Object.keys( tokens ).some( ( k ) => /^color/.test( k ) && tokens[ k ] );
  if ( ! touched ) {
    return [];
  }
  const get = ( key ) => themeColor( tokens[ key ] || inheritedValue( key, appearance, theme ), theme );
  const solid = ( value, under ) => ( value && value !== 'transparent' ? value : under );
  const bg = solid( get( 'colorBackground' ), '#ffffff' );
  const fieldBg = solid( themeColor( tokens.colorSurface || '', theme ), bg );
  const pairs = [
    { id: 'label', fg: get( 'colorLabel' ), bg },
    { id: 'input', fg: get( 'colorInputText' ), bg: fieldBg },
    { id: 'button', fg: get( 'colorButtonText' ), bg: get( 'colorPrimary' ) },
  ];
  const issues = [];
  pairs.forEach( ( pair ) => {
    const ratio = contrastRatio( pair.fg, pair.bg );
    if ( ratio !== null && ratio < MIN_CONTRAST ) {
      issues.push( { id: pair.id, ratio } );
    }
  } );
  return issues;
}
