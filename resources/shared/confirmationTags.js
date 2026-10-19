/**
 * Fill confirmation merge tags the same way emails do.
 *
 * {field:key}, {key}, {form_title} and {entry_id}, with single or double braces.
 */

export function fillConfirmation(text, { values = {}, formTitle = '', entryId = '', encode = false } = {}) {
  return String(text || '').replace(/\{\{?\s*(?:field:)?([\w.-]+)\s*\}?\}/g, (match, key) => {
    let raw;
    if (key === 'form_title') {
      raw = formTitle;
    } else if (key === 'entry_id') {
      raw = entryId;
    } else if (Object.prototype.hasOwnProperty.call(values, key)) {
      raw = values[key];
    } else {
      return match.includes('field:') || match.includes(key) ? '' : match;
    }
    if (raw === undefined || raw === null) {
      return '';
    }
    const str = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'object'
        ? Object.values(raw).filter(Boolean).join(' ')
        : String(raw);
    return encode ? encodeURIComponent(str) : str;
  });
}
