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

/** A Repeater: its fields are answered inside each group, under their own IDs. */
const REPEATER_TYPE = 'repeat_container';

function nodeKey(node) {
  const config = node.config && typeof node.config === 'object' ? node.config : {};
  const key = node.key ?? config.key;
  return typeof key === 'string' ? key : '';
}

function nodeLists(node) {
  const config = node.config && typeof node.config === 'object' ? node.config : {};
  const lists = [node.children, node.fields, config.children];
  if (Array.isArray(node.columns)) {
    node.columns.forEach((column) => lists.push(Array.isArray(column) ? column : column?.children ?? column?.fields));
  }
  return lists.filter(Array.isArray);
}

/**
 * Walk schema fields, telling the visitor each node, its nearest Repeater
 * (null for the form itself) and its parent chain.
 *
 * @param {Array}    fields  Schema fields.
 * @param {Function} visitor (node, repeater) => void.
 */
function walkFields(fields, visitor) {
  const walk = (list, repeater) => {
    (Array.isArray(list) ? list : []).forEach((node) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      visitor(node, repeater);
      const inner = node.type === REPEATER_TYPE ? node : repeater;
      nodeLists(node).forEach((child) => walk(child, inner));
    });
  };
  walk(fields, null);
}

/**
 * Find a field node by its builder node ID (or, without one, by its ID), with
 * the Repeater it belongs to.
 *
 * @param {Array}       fields   Schema fields.
 * @param {string}      key      Field ID.
 * @param {string|null} nodeId   Builder node ID.
 * @return {{ node: Object, repeater: Object|null }|null} Match.
 */
export function locateField(fields, key, nodeId = null) {
  let found = null;
  walkFields(fields, (node, repeater) => {
    if (found || typeof node.type !== 'string') {
      return;
    }
    if (nodeId ? node.id === nodeId : nodeKey(node) === key) {
      found = { node, repeater };
    }
  });
  return found;
}

/**
 * IDs a field cannot take: those of the other fields in its namespace. The
 * form is one namespace; each Repeater is its own, because its fields are
 * answered inside each group (the server applies the same rule).
 *
 * @param {Array}  fields Schema fields.
 * @param {string} nodeId Builder node ID of the field being edited.
 * @return {Set<string>} IDs.
 */
export function namespaceKeys(fields, nodeId) {
  const target = locateField(fields, '', nodeId);
  const scope = target ? target.repeater : null;
  const keys = new Set();
  walkFields(fields, (node, repeater) => {
    const key = nodeKey(node);
    if (key && repeater === scope && node.id !== nodeId) {
      keys.add(key);
    }
  });
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
 * the billing details an add-on WooCommerce checkout takes from the
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
 * Only the selected field is renamed. A field inside a Repeater lives in
 * that Repeater's namespace: references inside the Repeater follow, and so
 * do {repeater.field} tags elsewhere. A field outside Repeaters leaves alone
 * any Repeater that has its own field with the same ID.
 *
 * @param {Object}      schema Form schema.
 * @param {string}      oldKey Current ID.
 * @param {string}      newKey New ID.
 * @param {string|null} nodeId Builder node ID of the field (recommended; without
 *   it the first field with the old ID is renamed).
 * @return {{ schema: Object, references: number }} New schema, and how many
 *   references other than the field itself were updated.
 */
export function renameFieldKey(schema, oldKey, newKey, nodeId = null) {
  if (!schema || !oldKey || !newKey || oldKey === newKey) {
    return { schema, references: 0 };
  }
  const where = locateField(schema.fields, oldKey, nodeId);
  if (!where || nodeKey(where.node) !== oldKey) {
    return { schema, references: 0 };
  }
  const target = where.node;
  const owner = where.repeater;
  const ownerKey = owner ? nodeKey(owner) : '';
  // Repeaters that answer their own field with the old ID: a rename from
  // outside does not reach into them.
  const shadowing = (node) =>
    node &&
    node.type === REPEATER_TYPE &&
    node !== owner &&
    locateField(nodeLists(node).flat(), oldKey) !== null;

  let references = 0;

  const text = (value, inScope) => {
    let out = value;
    if (inScope) {
      const result = renameKeyInText(out, oldKey, newKey);
      references += result.count;
      out = result.text;
    }
    if (ownerKey) {
      const dotted = renameKeyInText(out, `${ownerKey}.${oldKey}`, `${ownerKey}.${newKey}`);
      references += dotted.count;
      out = dotted.text;
    }
    return out;
  };

  // Properties that hold a node's own fields.
  const LIST_PROPS = new Set(['children', 'fields', 'columns']);

  const visit = (value, path, inScope) => {
    if (typeof value === 'string') {
      return text(value, inScope);
    }
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((item, i) => {
        const out = visit(item, path.concat(i), inScope);
        changed = changed || out !== item;
        return out;
      });
      return changed ? next : value;
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    // A Repeater's own settings (its ID, label, logic) belong to the
    // namespace around it; its fields belong to its own namespace.
    let listScope = inScope;
    if (value === owner) {
      listScope = true;
    } else if (!owner && shadowing(value)) {
      listScope = false;
    }
    return visitObject(value, path, inScope, listScope);
  };

  const visitObject = (value, path, ownScope, listScope) => {
    const contextProps = Object.keys(CONTEXT_PROPS)
      .filter((name) => path.includes(name))
      .map((name) => CONTEXT_PROPS[name]);
    const isTarget = value === target;
    let changed = false;
    const next = {};
    Object.keys(value).forEach((prop) => {
      const item = value[prop];
      const scope = LIST_PROPS.has(prop) ? listScope : ownScope;
      let out;
      if (prop === 'key' && isTarget) {
        out = newKey;
      } else if (prop === 'config' && item && typeof item === 'object' && !Array.isArray(item) && (isTarget || listScope !== ownScope)) {
        // A node wrapped in `config` keeps its ID and fields there.
        out = visitObject(item, path.concat(prop), ownScope, listScope);
        if (isTarget && item.key === oldKey) {
          out = { ...out, key: newKey };
        }
      } else if (
        scope &&
        typeof item === 'string' &&
        item === oldKey &&
        (REFERENCE_PROPS.has(prop) || contextProps.some((set) => set.has(prop)))
      ) {
        out = newKey;
        references += 1;
      } else {
        out = visit(item, path.concat(prop), scope);
      }
      changed = changed || out !== item;
      next[prop] = out;
    });
    return changed ? next : value;
  };

  return { schema: visit(schema, [], !owner), references };
}
