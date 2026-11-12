import { compositeValueKeys } from './compositeParts';

/**
 * Fill confirmation merge tags the same way emails do.
 *
 * {field:key}, {key}, {form_title} and {entry_id}, with single or double braces.
 * {field:key:part} gives one scalar part of an object answer, for example
 * {field:address:city}, and nothing when the part is missing. A part name
 * works as well as an answer key: {field:address:street} reads street_address.
 * Pass `fieldTypes` (see fieldTypesOf) so the name is read for the right type.
 */

const COMPOSITE_TYPES = ['address_group', 'name_group'];

/**
 * Field key => type for a schema, so a part name can be read for a Name or
 * Address answer.
 *
 * @param {Object} schema Form schema.
 * @return {Object<string,string>}
 */
export function fieldTypesOf(schema) {
  const out = {};
  (function walk(list) {
    (Array.isArray(list) ? list : []).forEach((f) => {
      if (!f || typeof f !== 'object') return;
      const k = f.config?.key || f.key;
      if (k && f.type) out[k] = f.type;
      walk(f.children);
      walk(f.fields);
      (f.columns || []).forEach((c) => walk(c));
    });
  })(schema?.fields);
  return out;
}

/** The scalar at a key, or a part name's answer key, of an object answer; else an empty string. */
function partText(answer, part, type) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return '';
  // Without a known type, try each composite type's part names.
  const types = type ? [type] : COMPOSITE_TYPES;
  const keys = [part];
  types.forEach((t) => compositeValueKeys(t, part).forEach((k) => keys.push(k)));
  for (const k of keys) {
    if (['string', 'number', 'boolean'].includes(typeof answer[k])) return String(answer[k]);
  }
  return '';
}

export function fillConfirmation(text, { values = {}, formTitle = '', entryId = '', encode = false, fieldTypes = {} } = {}) {
  return String(text || '').replace(/\{\{?\s*(?:field:)?([\w.-]+)(?::([\w.-]+))?\s*\}?\}/g, (match, key, part) => {
    let raw;
    if (part) {
      // A key holds no colon, so what follows the first one is the part.
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        return match.includes('field:') ? '' : match;
      }
      const text = partText(values[key], part, fieldTypes[key]);
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
