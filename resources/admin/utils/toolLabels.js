/**
 * A form option that stays unique when two forms share a title.
 *
 * @param {{id?: number, title?: string, status?: string}} form Form.
 * @return {string}
 */
export function formOptionLabel(form) {
  const title = form?.title || `Form #${form?.id || ''}`;
  const status = form?.status || 'draft';
  return `${title} (#${form?.id || ''}, ${status})`;
}
