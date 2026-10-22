/**
 * Country name or code to ISO code, for conditional logic on a Country field.
 *
 * The country list is only downloaded on a live page whose form has a country
 * or phone country picker (2.6.0). conditions.js asks this tiny file instead
 * of importing the list, and countries.js plugs its lookup in when it loads.
 * A rule can only name a country when its form has a Country field, so the
 * list is always here when such a rule runs.
 */
let lookup = null;

/**
 * Plug in the lookup (countries.js does this).
 *
 * @param {Function|null} fn (text) => ISO code or ''.
 */
export function setCountryLookup(fn) {
  lookup = typeof fn === 'function' ? fn : null;
}

/**
 * The ISO code for a country code or name, '' when unknown or when the list
 * is not loaded.
 *
 * @param {*} text Code or name.
 * @return {string}
 */
export function countryCodeLookup(text) {
  return lookup ? lookup(text) : '';
}
