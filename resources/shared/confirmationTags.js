/**
 * Fill confirmation merge tags the same way emails do.
 *
 * {field:key}, {key}, {form_title} and {entry_id}, with single or double braces.
 * {field:key:part} gives one scalar part of an object answer, for example
 * {field:address:city}, and nothing when the part is missing.
 */

export function fillConfirmation(text, { values = {}, formTitle = '', entryId = '', encode = false } = {}) {
  return String(text || '').replace(/\{\{?\s*(?:field:)?([\w.-]+)(?::([\w.-]+))?\s*\}?\}/g, (match, key, part) => {
    let raw;
    if (part) {
      // A key holds no colon, so what follows the first one is the part.
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        return match.includes('field:') ? '' : match;
      }
      const scalar = values[key] && typeof values[key] === 'object' && !Array.isArray(values[key])
        ? values[key][part]
        : undefined;
      const text = ['string', 'number', 'boolean'].includes(typeof scalar) ? String(scalar) : '';
      return encode ? encodeURIComponent(text) : text;
    }
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
