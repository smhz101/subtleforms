/** Country flags setting (2.7.2), kept apart so the main bundle stays small. */

/**
 * Whether a Phone or Country field setting asks for flags. Mirrors
 * FrontendAssets::wantsFlags() on the server.
 *
 * @param {*} value Saved `showFlags` value.
 * @return {boolean}
 */
export function flagsOn(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}
