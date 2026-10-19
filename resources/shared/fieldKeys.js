/**
 * Field IDs (field keys): the rules for a custom ID, and renaming an ID
 * everywhere a form refers to it (2.4.1).
 *
 * A field's ID is the key its answers are stored under. It appears in merge
 * tags ({email}, {{email}}, {field:email}, {name.first}), calculation
 * formulas ({quantity} * {price}), conditional logic rules, integration
 * field maps and payment settings. Renaming a field updates all of them in
 * the same change, so nothing points at the old ID afterwards.
 *
 * The server applies the same rules (SubtleForms\Support\SchemaValidator).
 */

/** Longest ID allowed. */
export const FIELD_KEY_MAX = 64;

/**
 * Names a field ID cannot take: values the browser sends with every entry
 * (spam checks, CAPTCHA tokens, the payment reference), request parameters,
 * and the global merge tags, which would hide the field's answer.
 */
export const RESERVED_FIELD_KEYS = [
  'website_url',
  'form_rendered_at',
  'g-recaptcha-response',
  'h-captcha-response',
  'cf-turnstile-response',
  'subtleforms_classic',
  'subtleforms_form_id',
  'form_id',
  'data',
  'meta',
  'preview',
  'field',
  'all_fields',
  'form_title',
  'entry_id',
  'site_name',
  'admin_email',
  'date',
];

/** Lower case letters, numbers, underscores and hyphens, starting with a letter. */
const KEY_PATTERN = /^[a-z][a-z0-9_-]*$/;

/**
 * Tidy what is typed into the ID box: lower case, and spaces become
 * underscores, so "First Name" turns into "first_name" as it is typed.
 *
 * @param {string} value Typed text.
 * @return {string} Tidied text.
 */
export function tidyFieldKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * Every field ID used in a list of schema fields, including fields inside
 * steps, columns, containers and repeaters.
 *
 * @param {Array} fields Schema fields.
 * @return {Set<string>} IDs.
 */
export function collectFieldKeys(fields) {
  const keys = new Set();
  const walk = (list) => {
    (Array.isArray(list) ? list : []).forEach((node) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      const config = node.config && typeof node.config === 'object' ? node.config : {};
      const key = node.key ?? config.key;
      if (typeof key === 'string' && key) {
        keys.add(key);
      }
      walk(node.children);
      walk(node.fields);
      walk(config.children);
      if (Array.isArray(node.columns)) {
        node.columns.forEach((column) => walk(Array.isArray(column) ? column : column?.children ?? column?.fields));
      }
    });
  };
  walk(fields);
  return keys;
}

/**
 * Why a new ID cannot be used, or '' when it can.
 *
 * @param {string}      value       Proposed ID.
 * @param {Set<string>} usedKeys    IDs of the other fields of the form.
 * @return {string} Plain sentence, or ''.
 */
export function fieldKeyProblem(value, usedKeys = new Set()) {
  const key = String(value ?? '');
  if (!key) {
    return 'empty';
  }
  if (key.length > FIELD_KEY_MAX) {
    return 'long';
  }
  if (!/^[a-z]/.test(key)) {
    return 'start';
  }
  if (!KEY_PATTERN.test(key)) {
    return 'characters';
  }
  if (RESERVED_FIELD_KEYS.includes(key)) {
    return 'reserved';
  }
  if (usedKeys.has(key)) {
    return 'taken';
  }
  return '';
}

/** Properties that hold another field's ID. */
const REFERENCE_PROPS = new Set([
  'field',
  'sourceField',
  'target',
  'fieldKey',
  'field_key',
  'amountField',
  'consent_field',
]);

/**
 * Properties that hold a field ID only inside a given part of the schema:
 * the email marketing and CRM identity fields (metadata.integrations), and
 * the billing details a SubtleForms Pro WooCommerce checkout takes from the
 * form (metadata.payment.billing).
 */
const CONTEXT_PROPS = {
  integrations: new Set(['email', 'first_name', 'last_name', 'phone', 'company']),
  billing: new Set(['email', 'name', 'last_name', 'phone', 'company', 'address']),
};

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace the old ID in brace tags inside a piece of text: {old}, {{old}},
 * {field:old}, {old.first} and {{ old }}. A longer ID that only starts with
 * the old one ({old_2}) is left alone.
 *
 * @param {string} text   Text.
 * @param {string} oldKey Old ID.
 * @param {string} newKey New ID.
 * @return {{ text: string, count: number }} New text and tags changed.
 */
export function renameKeyInText(text, oldKey, newKey) {
  if (typeof text !== 'string' || !text.includes(oldKey)) {
    return { text, count: 0 };
  }
  const pattern = new RegExp(
    `(\\{\\{?\\s*(?:field:)?)${escapeRegExp(oldKey)}(?=(?:[.:][\\w-]+)*\\s*\\}\\}?)`,
    'g'
  );
  let count = 0;
  const next = text.replace(pattern, (match, open) => {
    count += 1;
    return `${open}${newKey}`;
  });
  return { text: next, count };
}

/**
 * Rename a field's ID everywhere in a form schema: the field itself, logic
 * rules, merge tags and formulas in any text, integration field maps and
 * payment settings. Entries are not touched; their answers stay under the
 * old ID.
 *
 * @param {Object} schema Form schema.
 * @param {string} oldKey Current ID.
 * @param {string} newKey New ID.
 * @return {{ schema: Object, references: number }} New schema, and how many
 *   references other than the field itself were updated.
 */
export function renameFieldKey(schema, oldKey, newKey) {
  if (!schema || !oldKey || !newKey || oldKey === newKey) {
    return { schema, references: 0 };
  }
  let references = 0;

  const visit = (value, path) => {
    if (typeof value === 'string') {
      const result = renameKeyInText(value, oldKey, newKey);
      references += result.count;
      return result.text;
    }
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((item, i) => {
        const out = visit(item, path.concat(i));
        changed = changed || out !== item;
        return out;
      });
      return changed ? next : value;
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    const contextProps = Object.keys(CONTEXT_PROPS)
      .filter((name) => path.includes(name))
      .map((name) => CONTEXT_PROPS[name]);
    // The field being renamed: a node with a type and this key.
    const isTarget = typeof value.type === 'string' && value.key === oldKey;
    let changed = false;
    const next = {};
    Object.keys(value).forEach((prop) => {
      const item = value[prop];
      let out;
      if (prop === 'key' && isTarget) {
        out = newKey;
      } else if (
        typeof item === 'string' &&
        item === oldKey &&
        (REFERENCE_PROPS.has(prop) || contextProps.some((set) => set.has(prop)))
      ) {
        out = newKey;
        references += 1;
      } else {
        out = visit(item, path.concat(prop));
      }
      changed = changed || out !== item;
      next[prop] = out;
    });
    return changed ? next : value;
  };

  return { schema: visit(schema, []), references };
}
