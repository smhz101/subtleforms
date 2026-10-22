/**
 * A form's public data printed into the page by the server (2.6.1).
 *
 * The shortcode and the block print the same data the schema route returns
 * in a JSON script tag, so the form can be drawn without a request to the
 * REST API. That request is a full round trip, and on slow hosts or behind a
 * caching plugin that bypasses REST it is the slowest part of the page. The
 * route stays as the fallback for forms mounted from script (popups, page
 * builders) and for pages where the server did not print the data.
 *
 * The data holds only what the route returns to a visitor: the public
 * schema and a signed load time. It never holds a nonce, so a cached page
 * cannot carry one that has expired.
 */

/** Id of the script tag that holds a form's data. */
export const inlineDataId = (formId) => `sf-form-data-${formId}`;

/**
 * Read the data the server printed for a form.
 *
 * @param {number}   formId Form ID.
 * @param {Document} [doc]  Document (tests).
 * @return {{schema: Object, spamToken: string, version: *}|null} The data, or null
 *   when the page has none for this form or it cannot be read.
 */
export function readInlineFormData(formId, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !formId) {
    return null;
  }
  const node = doc.getElementById(inlineDataId(formId));
  if (!node) {
    return null;
  }
  try {
    const data = JSON.parse(node.textContent || '');
    const schema = data?.schema;
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return null;
    }
    return {
      schema,
      spamToken: typeof data.spam_token === 'string' ? data.spam_token : '',
      version: data.version ?? null,
    };
  } catch (e) {
    return null;
  }
}
