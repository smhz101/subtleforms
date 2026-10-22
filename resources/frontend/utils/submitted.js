/**
 * Tell the page that a form was sent.
 *
 * Both renderers call this after a successful, non-preview submit. It fires
 * `subtleforms:submitted` on the document with `detail.formId`, so scripts
 * from add-ons (for example form analytics) can react without touching the
 * form. Nothing in this plugin listens for it.
 */

/** Event fired on the document after a form is sent. */
export const SUBMITTED_EVENT = 'subtleforms:submitted';

/**
 * @param {number}   formId Form ID.
 * @param {Document} doc    Document, for tests.
 */
export function announceSubmitted(formId, doc = document) {
  try {
    doc.dispatchEvent(new CustomEvent(SUBMITTED_EVENT, { detail: { formId: Number(formId) } }));
  } catch (e) {
    // An add-on listener must never break the confirmation.
  }
}
