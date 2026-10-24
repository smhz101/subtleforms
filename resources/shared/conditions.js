import { sameCheckValue } from './logicFields';
import { countryCodeLookup as countryCodeFor } from './countryLookup';
import { getLogicExtensions } from './extend';
/**
 * Conditional logic: one evaluator for the builder, the frontend renderer and
 * (mirrored line for line) the server in src/Engine/ConditionalLogic.php.
 *
 * Both implementations are checked against the same fixture file,
 * tests/fixtures/conditional-logic.json, so a form behaves the same in the
 * browser and on submit.
 *
 * Logic object (stored on a field, step, action or confirmation as `logic`):
 *
 *   {
 *     action: 'show' | 'hide' | 'require' | 'disable',   // fields and steps only
 *     groups: [
 *       { match: 'all' | 'any', rules: [ { field, operator, value, value2 } ] }
 *     ]
 *   }
 *
 * This plugin evaluates the basic form on fields: one group whose rules must
 * all match, with the basic operators. Several groups (OR), the "any" match,
 * the other operators and logic on steps, actions and confirmations belong to
 * an add-on that registers a logic extension (see
 * registerLogicExtension in extend.js). Logic nobody evaluates is ignored, as
 * if the field had no rule, exactly like the server.
 *
 * The older `conditions: [ { sourceField, operator, value, effect } ]` shape
 * is still read: rules sharing an effect become one "all" group.
 */

/** Operators this plugin evaluates. */
export const BASIC_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'empty',
  'not_empty',
  'greater_than',
  'less_than',
];

/** Operators that take no comparison value. */
export const VALUELESS_OPERATORS = ['empty', 'not_empty'];

const NUMERIC_RE = /^\s*[-+]?(\d+(\.\d*)?|\.\d+)\s*$/;
const MAX_PASSES = 5;

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Scalar or composite value as text. Booleans become "true"/"false". */
export function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(toText).filter((s) => s.trim() !== '').join(', ');
  }
  if (isPlainObject(value)) {
    return Object.values(value)
      .map(toText)
      .filter((s) => s.trim() !== '')
      .join(' ');
  }
  return String(value);
}

/** Values to test: each item of a multi-value answer, else the one value. */
export function listOf(value) {
  if (Array.isArray(value)) return value.map(toText);
  // An empty object arrives on the server as an empty list; match that.
  if (isPlainObject(value) && Object.keys(value).length === 0) return [];
  return [toText(value)];
}

export const norm = (s) => String(s).trim().toLowerCase();

export function isNumeric(s) {
  return typeof s === 'number' ? Number.isFinite(s) : NUMERIC_RE.test(String(s));
}

export function textEquals(a, b) {
  if (isNumeric(a) && isNumeric(b)) return parseFloat(a) === parseFloat(b);
  return norm(a) === norm(b);
}

/**
 * A Country field stores the ISO code or the name, depending on its Output
 * Format, and a rule holds the code the builder picked. Both sides compare as
 * codes when they name a known country (FB-20).
 */
export function countryEquals(x, expected) {
  const want = countryCodeFor(expected);
  const have = countryCodeFor(x);
  if (want !== '' && have !== '') return want === have;
  return textEquals(x, expected);
}

function isEmptyForField(value, field) {
  if (field && field.type === 'toggle') {
    const off = field.offValue || field.config?.offValue || 'no';
    return isEmptyValue(value) || textEquals(value, off);
  }
  return isEmptyValue(value);
}

export function isEmptyValue(value) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number' || value === true) return false;
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (isPlainObject(value)) return Object.values(value).every(isEmptyValue);
  return false;
}

/**
 * Whether one answer satisfies one operator.
 *
 * @param {*}      value    The answer (string, number, array, object, bool).
 * @param {string} operator Operator key.
 * @param {*}      compare  The rule's value.
 * @param {*}      compare2 Upper bound for "between" (an add-on operator).
 * @param {Object} opts     { today: 'YYYY-MM-DD', field }.
 */
export function evaluateCondition(value, operator, compare, compare2, opts = {}) {
  const items = listOf(value);
  const c = toText(compare);

  switch (operator) {
    case 'equals':
      if (opts.field && (opts.field.type === 'checkbox' || opts.field.type === 'consent')) {
        return sameCheckValue(value, c);
      }
      if (opts.field && opts.field.type === 'country') {
        return items.some((x) => countryEquals(x, c));
      }
      return items.some((x) => textEquals(x, c));
    case 'not_equals':
      if (opts.field && (opts.field.type === 'checkbox' || opts.field.type === 'consent')) {
        return !sameCheckValue(value, c);
      }
      if (opts.field && opts.field.type === 'country') {
        return !items.some((x) => countryEquals(x, c));
      }
      return !items.some((x) => textEquals(x, c));
    case 'contains':
    case 'not_contains': {
      const needle = norm(c);
      let found = false;
      if (needle !== '') {
        found = Array.isArray(value)
          ? items.some((x) => norm(x) === needle)
          : norm(toText(value)).includes(needle);
      }
      return operator === 'contains' ? found : !found;
    }
    case 'empty':
      return isEmptyForField(value, opts.field);
    case 'not_empty':
      return !isEmptyForField(value, opts.field);
    case 'greater_than':
      return isNumeric(c) && items.some((x) => isNumeric(x) && parseFloat(x) > parseFloat(c));
    case 'less_than':
      return isNumeric(c) && items.some((x) => isNumeric(x) && parseFloat(x) < parseFloat(c));
    default:
      return extensionCondition(value, operator, compare, compare2, opts);
  }
}

/** An operator this plugin does not know: ask the logic extensions. */
function extensionCondition(value, operator, compare, compare2, opts) {
  for (const ext of getLogicExtensions()) {
    if (typeof ext.evaluateCondition !== 'function') continue;
    try {
      const result = ext.evaluateCondition(value, operator, compare, compare2, { today: localToday(), ...opts }, helpers);
      if (result !== null && result !== undefined) return !!result;
    } catch (e) {
      // A broken add-on must not stop the form.
    }
  }
  return false;
}

/** The evaluator's own helpers, handed to logic extensions. */
export const helpers = {
  toText,
  listOf,
  norm,
  isNumeric,
  isEmptyValue,
  textEquals,
  countryEquals,
  readValue: (values, key) => readValue(values, key),
  today: () => localToday(),
  // One rule, basic or not: an extension's group logic uses it per rule.
  evaluateCondition: (value, operator, compare, compare2, opts) =>
    evaluateCondition(value, operator, compare, compare2, opts),
};

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Read a value by key, following dots into nested objects. */
function readValue(values, key) {
  if (!values || typeof key !== 'string' || key === '') return undefined;
  if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
  const parts = key.split('.');
  let cur = values;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function normalizeRule(rule) {
  if (!isPlainObject(rule)) return null;
  const field = rule.field ?? rule.sourceField ?? '';
  if (typeof field !== 'string' || field === '') return null;
  return {
    field,
    operator: typeof rule.operator === 'string' && rule.operator ? rule.operator : 'equals',
    value: rule.value ?? '',
    value2: rule.value2 ?? '',
  };
}

/**
 * Normalise a logic object: drop empty rules and groups.
 *
 * @return {{action:string, groups:Array}|null} null when nothing to evaluate.
 */
export function normalizeLogic(logic) {
  if (!isPlainObject(logic)) return null;
  let groups = Array.isArray(logic.groups) ? logic.groups : null;
  if (!groups && Array.isArray(logic.rules)) {
    groups = [{ match: logic.match, rules: logic.rules }];
  }
  if (!groups) return null;
  const clean = [];
  groups.forEach((g) => {
    if (!isPlainObject(g) || !Array.isArray(g.rules)) return;
    const rules = g.rules.map(normalizeRule).filter(Boolean);
    if (rules.length) clean.push({ match: g.match === 'any' ? 'any' : 'all', rules });
  });
  if (!clean.length) return null;
  const action = ['show', 'hide', 'require', 'disable'].includes(logic.action)
    ? logic.action
    : 'show';
  return { action, groups: clean };
}

/**
 * Whether normalised logic is the basic form this plugin evaluates itself:
 * on a field, one group whose rules must all match, basic operators only.
 */
export function isBasic(l, scope = 'field') {
  return (
    scope === 'field' &&
    !!l &&
    l.groups.length === 1 &&
    l.groups[0].match === 'all' &&
    l.groups[0].rules.every((r) => BASIC_OPERATORS.includes(r.operator))
  );
}

/** Whether this page evaluates a normalised logic object. */
export function isSupported(l, scope = 'field') {
  if (isBasic(l, scope)) return true;
  return getLogicExtensions().some((ext) => {
    try {
      return typeof ext.supports === 'function' && !!ext.supports(l, scope);
    } catch (e) {
      return false;
    }
  });
}

/**
 * Whether a logic object's conditions are met. Inactive logic passes, and so
 * does logic nobody evaluates.
 *
 * @param {*}      logic  Logic object.
 * @param {Object} values Answers.
 * @param {Object} opts   { today, fieldsByKey }.
 * @param {string} scope  field, step, action or confirmation.
 */
export function logicPasses(logic, values, opts = {}, scope = 'field') {
  const l = normalizeLogic(logic);
  if (!l) return true;
  const test = (r) =>
    evaluateCondition(readValue(values, r.field), r.operator, r.value, r.value2, {
      ...opts,
      field: opts.fieldsByKey ? opts.fieldsByKey[r.field] : undefined,
    });
  if (isBasic(l, scope)) {
    return l.groups[0].rules.every(test);
  }
  for (const ext of getLogicExtensions()) {
    if (typeof ext.passes !== 'function') continue;
    try {
      if (ext.supports && !ext.supports(l, scope)) continue;
      const result = ext.passes(l, values, helpers, { today: localToday(), ...opts }, scope);
      if (result !== null && result !== undefined) return !!result;
    } catch (e) {
      // A broken add-on must not stop the form.
    }
  }
  return true;
}

/** Whether a logic object has a rule that is evaluated on this page. */
export function hasLogic(logic, scope = 'field') {
  const l = normalizeLogic(logic);
  return l !== null && isSupported(l, scope);
}

/**
 * All logic objects attached to a node: `logic` first, else the legacy
 * per-rule `conditions` grouped by effect.
 */
export function nodeLogics(node) {
  const scope = isPlainObject(node) && node.type === 'step' ? 'step' : 'field';
  return allNodeLogics(node).filter((l) => isSupported(l, scope));
}

function allNodeLogics(node) {
  if (!isPlainObject(node)) return [];
  const cfg = isPlainObject(node.config) ? node.config : {};
  const logic = node.logic ?? cfg.logic;
  const one = normalizeLogic(logic);
  if (one) return [one];

  const legacy = node.conditions ?? cfg.conditions;
  if (!Array.isArray(legacy) || !legacy.length) return [];
  const byEffect = [];
  legacy.forEach((c) => {
    if (!isPlainObject(c)) return;
    const effect = typeof c.effect === 'string' && c.effect ? c.effect : 'show';
    let entry = byEffect.find((e) => e.action === effect);
    if (!entry) {
      entry = { action: effect, groups: [{ match: 'all', rules: [] }] };
      byEffect.push(entry);
    }
    entry.groups[0].rules.push(c);
  });
  return byEffect.map(normalizeLogic).filter(Boolean);
}

function nodeKey(node) {
  const cfg = isPlainObject(node.config) ? node.config : {};
  const key = node.key ?? cfg.key ?? (node.type === 'step' ? node.id : undefined);
  return typeof key === 'string' && key !== '' ? key : null;
}

function childLists(node) {
  const lists = [];
  if (Array.isArray(node.children)) lists.push(node.children);
  if (Array.isArray(node.fields)) lists.push(node.fields);
  if (Array.isArray(node.columns)) {
    node.columns.forEach((col) => {
      if (Array.isArray(col)) lists.push(col);
      else if (isPlainObject(col)) {
        if (Array.isArray(col.fields)) lists.push(col.fields);
        if (Array.isArray(col.children)) lists.push(col.children);
      }
    });
  }
  return lists;
}

function indexLogicFields(nodes, out) {
  if (!Array.isArray(nodes)) return out;
  nodes.forEach((node) => {
    if (!node || typeof node !== 'object') return;
    const key = node.key || node.config?.key;
    if (key) {
      out[key] = { ...node, ...(node.config && typeof node.config === 'object' ? node.config : {}) };
    }
    childLists(node).forEach((list) => indexLogicFields(list, out));
  });
  return out;
}

function evaluateOnce(fields, values, opts) {
  const fieldsByKey = indexLogicFields(fields, {});
  const withFields = { ...opts, fieldsByKey };
  const state = { hidden: [], required: [], disabled: [], hiddenSteps: [] };
  const add = (list, key) => {
    if (key && !list.includes(key)) list.push(key);
  };

  // `scope` holds the answers rules read and the key prefix of a Repeater
  // group: inside group i of Repeater `items`, a child `qty` is reported as
  // `items.i.qty` and its rules read that group's answers first (2.3.1).
  const walk = (nodes, parentHidden, scope) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      if (!isPlainObject(node)) return;
      const rawKey = nodeKey(node);
      const key = rawKey && scope.prefix ? `${scope.prefix}${rawKey}` : rawKey;
      let hidden = parentHidden;

      const logicScope = node.type === 'step' ? 'step' : 'field';
      nodeLogics(node).forEach((l) => {
        const passes = logicPasses(l, scope.values, withFields, logicScope);
        if ((l.action === 'show' && !passes) || (l.action === 'hide' && passes)) {
          hidden = true;
        } else if (l.action === 'require' && passes) {
          add(state.required, key);
        } else if (l.action === 'disable' && passes) {
          add(state.disabled, key);
        }
      });

      if (hidden) {
        add(node.type === 'step' ? state.hiddenSteps : state.hidden, key);
      }

      if (node.type === 'repeat_container' && rawKey) {
        const groups = repeaterGroups(readValue(scope.values, rawKey));
        groups.forEach((group, index) => {
          const groupScope = {
            values: { ...scope.values, ...group },
            prefix: `${key}.${index}.`,
          };
          childLists(node).forEach((list) => walk(list, hidden, groupScope));
        });
        return;
      }
      childLists(node).forEach((list) => walk(list, hidden, scope));
    });
  };

  walk(fields, false, { values, prefix: '' });
  return state;
}

/**
 * The groups of a Repeater answer: a list of objects (at least one, so the
 * first group's rules are known before anything is typed).
 */
export function repeaterGroups(value) {
  if (Array.isArray(value)) {
    const groups = value.map((g) => (isPlainObject(g) ? g : {}));
    return groups.length ? groups : [{}];
  }
  if (isPlainObject(value)) {
    // Indexed object { 0: {...}, 1: {...} } from a form post.
    const groups = Object.keys(value)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (isPlainObject(value[k]) ? value[k] : {}));
    return groups.length ? groups : [{}];
  }
  return [{}];
}

function applyGlobalRules(rules, values, state, opts) {
  if (!Array.isArray(rules)) return;
  rules.forEach((rule) => {
    if (!isPlainObject(rule) || !isPlainObject(rule.if) || !isPlainObject(rule.then)) return;
    const field = rule.if.field;
    const target = rule.then.target;
    if (!field || !target) return;
    const ok = evaluateCondition(
      readValue(values, field),
      rule.if.operator || 'equals',
      rule.if.value ?? '',
      rule.if.value2 ?? '',
      opts
    );
    if (!ok) return;
    switch (rule.then.action) {
      case 'show':
        state.hidden = state.hidden.filter((k) => k !== target);
        break;
      case 'hide':
        if (!state.hidden.includes(target)) state.hidden.push(target);
        break;
      case 'require':
        if (!state.required.includes(target)) state.required.push(target);
        break;
      case 'disable':
        if (!state.disabled.includes(target)) state.disabled.push(target);
        break;
      default:
    }
  });
}

function withoutKeys(values, keys) {
  let out = { ...values };
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(out, k) || k.indexOf('.') === -1) {
      delete out[k];
      return;
    }
    out = withoutPath(out, k.split('.'));
  });
  return out;
}

// Remove a nested answer such as `items.1.qty` without touching the input.
function withoutPath(obj, parts) {
  if (obj === null || typeof obj !== 'object') return obj;
  const [head, ...rest] = parts;
  if (!(head in obj)) return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  if (!rest.length) {
    if (Array.isArray(copy)) copy[head] = undefined;
    else delete copy[head];
    return copy;
  }
  copy[head] = withoutPath(copy[head], rest);
  return copy;
}

/**
 * Which fields and steps are hidden, required or disabled for these answers.
 *
 * Hidden answers do not count: the form is re-evaluated without them until
 * nothing changes (at most five passes), so a field that depends on a hidden
 * field is hidden too.
 *
 * @param {Object} schema { fields, logic }.
 * @param {Object} values Answers keyed by field key.
 * @param {Object} opts   { today }.
 * @return {{hidden_fields:string[], required_fields:string[], disabled_fields:string[], hidden_steps:string[]}}
 */
export function computeLogicState(schema, values, opts = {}) {
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  const source = isPlainObject(values) ? values : {};
  let current = source;
  let state = null;
  let previous = null;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    state = evaluateOnce(fields, current, opts);
    applyGlobalRules(schema?.logic, current, state, opts);
    const signature = [...state.hidden].sort().join('|') + '#' + [...state.hiddenSteps].sort().join('|');
    if (signature === previous) break;
    previous = signature;
    current = withoutKeys(source, state.hidden);
  }

  return {
    hidden_fields: state.hidden,
    required_fields: state.required.filter((k) => !state.hidden.includes(k)),
    disabled_fields: state.disabled,
    hidden_steps: state.hiddenSteps,
  };
}

/**
 * Answers with hidden fields removed: what the server stores.
 */
export function visibleValues(schema, values, opts = {}) {
  const state = computeLogicState(schema, values, opts);
  return withoutKeys(values || {}, state.hidden_fields);
}

/**
 * The confirmation to show: the first conditional confirmation whose
 * conditions pass, else the form's default confirmation.
 *
 * @param {Object} metadata Form metadata ({ confirmation, confirmations }).
 * @param {Object} values   Visible answers.
 * @return {Object} Confirmation settings.
 */
export function pickConfirmation(metadata, values, opts = {}) {
  const meta = isPlainObject(metadata) ? metadata : {};
  const list = Array.isArray(meta.confirmations) ? meta.confirmations : [];
  for (const c of list) {
    if (!isPlainObject(c) || c.enabled === false) continue;
    if (hasLogic(c.logic, 'confirmation') && logicPasses(c.logic, values, opts, 'confirmation')) {
      return c;
    }
  }
  return isPlainObject(meta.confirmation) ? meta.confirmation : {};
}
