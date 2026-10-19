/**
 * Entry screen text, as formatted on the server.
 *
 * The server formats every answer once (SubtleForms\Support\AnswerFormatter)
 * for the entry screen, emails, CSV, PDF data and integrations, and sends the
 * result with the entry as `display`: per answer key its field name, its text
 * and, for list answers, one string per item. The entry screen only reads it.
 */

/**
 * The display row for an answer key, if the server sent one.
 *
 * @param {Object} display Entry `display` map.
 * @param {string} key     Answer key.
 * @return {Object|null} { label, text, items?, columns?, cells? }
 */
export function displayRow( display, key ) {
  const row = display && typeof display === 'object' ? display[ key ] : null;
  return row && typeof row === 'object' ? row : null;
}

/**
 * Readable text for an answer: the server text, else the stored value.
 *
 * @param {Object} display Entry `display` map.
 * @param {string} key     Answer key.
 * @param {*}      value   Stored value.
 * @return {string}
 */
export function displayText( display, key, value ) {
  const row = displayRow( display, key );
  if ( row && typeof row.text === 'string' ) {
    return row.text;
  }
  if ( value === null || value === undefined ) {
    return '';
  }
  return typeof value === 'object' ? JSON.stringify( value ) : String( value );
}

/**
 * One string per item of a list answer, or null.
 *
 * @param {Object} display Entry `display` map.
 * @param {string} key     Answer key.
 * @return {string[]|null}
 */
export function displayItems( display, key ) {
  const row = displayRow( display, key );
  return row && Array.isArray( row.items ) ? row.items.map( String ) : null;
}

/**
 * The field name for an answer key, or null when the server sent none.
 *
 * @param {Object} display Entry `display` map.
 * @param {string} key     Answer key.
 * @return {string|null}
 */
export function displayLabel( display, key ) {
  const row = displayRow( display, key );
  return row && typeof row.label === 'string' && row.label !== '' ? row.label : null;
}
