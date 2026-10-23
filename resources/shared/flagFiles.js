/**
 * Country flags (2.7.2).
 *
 * Each flag is its own SVG file, build/frontend/flags/<code>.svg, drawn with
 * <img>, so the browser downloads only the flags a form shows. Nothing here is
 * emoji: Windows does not draw flag emoji.
 */

const CODE = /^[A-Z]{2}$/;

/**
 * A two-letter country code safe to put in a file name, or ''.
 *
 * @param {string} code Country code.
 * @return {string} Upper case code.
 */
export function flagCode(code) {
  const upper = String(code || '').toUpperCase();
  return CODE.test(upper) ? upper : '';
}

/**
 * The folder with the flag files: the front end folder on the site, or the
 * same folder in the builder and the editor.
 *
 * @return {string} URL ending in a slash, or '' when unknown.
 */
export function flagBaseUrl() {
  if (typeof window === 'undefined') {
    return '';
  }
  const admin = window.subtleformsAdmin?.flagBaseUrl;
  if (typeof admin === 'string' && admin) {
    return admin.replace(/\/?$/, '/');
  }
  const base = window.subtleformsFrontend?.assetsUrl;
  if (typeof base === 'string' && base) {
    return `${base.replace(/\/?$/, '/')}flags/`;
  }
  return '';
}

/**
 * The address of one flag.
 *
 * @param {string} code Country code.
 * @param {string} base Folder URL.
 * @return {string} URL, or '' for a code that is not two letters.
 */
export function flagUrl(code, base = flagBaseUrl()) {
  const clean = flagCode(code);
  return clean && base ? `${base}${clean.toLowerCase()}.svg` : '';
}
