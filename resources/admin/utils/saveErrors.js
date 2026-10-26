/**
 * Turn a failed save response into a sentence that names the setting at
 * fault (2.3.1, QA-03): "Confirmation settings: ..." instead of
 * "Failed to autosave".
 */
import { __, sprintf } from '@wordpress/i18n';

const AREAS = [
  [/^schema\.metadata\.(confirmation|confirmations)/, () => __('Confirmation settings', 'subtleforms')],
  [/^schema\.metadata/, () => __('Form settings', 'subtleforms')],
  [/^schema\.actions/, () => __('Notifications & actions', 'subtleforms')],
  [/^schema\.fields/, () => __('Fields', 'subtleforms')],
  [/^schema\.logic/, () => __('Logic', 'subtleforms')],
];

/**
 * The field a schema path points at ("schema.fields[2].fields[0].label").
 *
 * @param {string} path   Error path.
 * @param {Object} schema Schema that was saved.
 * @return {Object|null}
 */
function fieldAt(path, schema) {
  const steps = String(path)
    .replace(/^schema\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let node = schema;
  let field = null;
  for (const step of steps) {
    if (node === null || typeof node !== 'object' || !(step in node)) break;
    node = node[step];
    if (/^\d+$/.test(step) && node && typeof node === 'object' && !Array.isArray(node)) {
      field = node;
    }
  }
  return field;
}

/**
 * A short name for a field: its label (cut to 40 characters), else its key.
 *
 * @param {Object} field Field node.
 * @return {string}
 */
function fieldName(field) {
  const config = field?.config && typeof field.config === 'object' ? field.config : {};
  const raw = [config.label, field?.label, config.adminLabel, field?.adminLabel].find(
    (v) => (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== ''
  );
  if (raw !== undefined) {
    const text = String(raw).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) return text.length > 40 ? `${text.slice(0, 40).trim()}...` : text;
  }
  return String(config.key || field?.key || '');
}

function areaOf(path) {
  // "Fields: Maximum length is 255 characters" does not say which setting.
  // Name the one that failed (the label, the help text, the placeholder).
  if (/^schema\.fields/.test(path)) {
    const leaf = path.split('.').pop();
    const names = {
      label: () => __('Field label', 'subtleforms'),
      description: () => __('Field help text', 'subtleforms'),
      placeholder: () => __('Placeholder', 'subtleforms'),
      title: () => __('Field title', 'subtleforms'),
    };
    if (names[leaf]) {
      return names[leaf]();
    }
    return __('Fields', 'subtleforms');
  }
  const hit = AREAS.find(([re]) => re.test(path));
  return hit ? hit[1]() : '';
}

/**
 * @param {Object} body   Error response body ({ error: { message, meta: { fields } } }).
 * @param {string} status HTTP status.
 * @param {Object} schema The schema that was sent, to name the field at fault.
 * @return {string} Readable message.
 */
export function describeSaveError(body, status, schema = null) {
  const error = body?.error || body?.data?.error || body || {};
  const fields = error?.meta?.fields || body?.meta?.fields || error?.fields || null;
  const base = error?.message || body?.message || '';
  if (fields && typeof fields === 'object') {
    // Field errors come as { path: message }, or, from schema validation on
    // publish, as a list of { path, message } (2.4.0).
    const entries = Array.isArray(fields)
      ? fields
          .filter((item) => item && typeof item === 'object')
          .map((item) => [String(item.path || ''), String(item.message || '')])
      : Object.entries(fields);
    const [path, message] = entries[0] || [];
    if (path) {
      const area = areaOf(path);
      // Name the field too, so a long or numeric label can be found (FLD2-11).
      const field = /^schema\.fields/.test(path) && schema ? fieldAt(path, { fields: schema.fields }) : null;
      const name = field ? fieldName(field) : '';
      if (area && name) {
        return sprintf(
          /* translators: 1: setting, 2: field label, 3: problem */
          __('%1$s in "%2$s": %3$s', 'subtleforms'),
          area,
          name,
          message
        );
      }
      return area
        ? sprintf(
            /* translators: 1: settings area, 2: problem */
            __('%1$s: %2$s', 'subtleforms'),
            area,
            message
          )
        : `${message}`;
    }
  }
  const code = Number(status);
  const generic = /valid response from the server|failed to autosave|could not reach the server/i;
  const lostContact = status === 0 || status === 'abort' || code >= 500 || !base || generic.test(base);
  // A server or network failure does not drop the draft sitting in this tab.
  if (lostContact) {
    return __('Your changes are kept in this tab.', 'subtleforms');
  }
  return base;
}
