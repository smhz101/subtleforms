/**
 * Where the browser downloads the form's field code files from (2.6.0).
 *
 * The files sit next to the main script, and webpack finds them from the
 * address of that script. A speed plugin that combines or moves scripts
 * changes that address, so the files would be looked for in the wrong
 * folder. Then the plugin's own build folder (sent by the server as
 * subtleformsFrontend.assetsUrl) is used instead.
 */

/**
 * The folder to load field code from, or '' to keep webpack's own.
 *
 * @param {string} src       Address of the running main script.
 * @param {string} assetsUrl The plugin's build/frontend/ folder.
 * @return {string} Folder URL ending in a slash, or ''.
 */
export function chunkBase(src, assetsUrl) {
  if (src && /\/build\/frontend\/frontend\.js(?:[?#]|$)/.test(String(src))) {
    return '';
  }
  const base = String(assetsUrl || '');
  if (!base) {
    return '';
  }
  return base.endsWith('/') ? base : `${base}/`;
}
