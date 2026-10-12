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
 * Groups are OR'ed: the logic passes when any group passes. A group passes
 * when all (or any) of its rules match. Free forms use one group matching
 * all rules; "any", several groups and the advanced operators are Pro.
 *
 * The older `conditions: [ { sourceField, operator, value, effect } ]` shape
 * is still read: rules sharing an effect become one "all" group.
 */

/** Operators every plan can use. */
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

/** Operators that need SubtleForms Pro (logic.conditional.advanced). */
export const ADVANCED_OPERATORS = [
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'between',
  'before',
  'after',
];

/** Operators that take no comparison value. */
export const VALUELESS_OPERATORS = ['empty', 'not_empty'];

const NUMERIC_RE = /^\s*[-+]?(\d+(\.\d*)?|\.\d+)\s*$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
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
function listOf(value) {
  if (Array.isArray(value)) return value.map(toText);
  // An empty object arrives on the server as an empty list; match that.
  if (isPlainObject(value) && Object.keys(value).length === 0) return [];
  return [toText(value)];
}

const norm = (s) => String(s).trim().toLowerCase();

export function isNumeric(s) {
  return typeof s === 'number' ? Number.isFinite(s) : NUMERIC_RE.test(String(s));
}

/**
 * ISO date (YYYY-MM-DD, optional time) as a sortable "YYYY-MM-DD HH:MM:SS"
 * string, or null. "today" resolves to the given day.
 */
export function toDate(s, today) {
  let str = String(s).trim();
  if (str.toLowerCase() === 'today') str = today || '';
  const m = DATE_RE.exec(str);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}`;
}

function textEquals(a, b) {
  if (isNumeric(a) && isNumeric(b)) return parseFloat(a) === parseFloat(b);
  return norm(a) === norm(b);
}

export function isEmptyValue(value) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number' || value === true) return false;
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (isPlainObject(value)) return Object.values(value).every(isEmptyValue);
  return false;
}

function optionList(compare) {
  if (Array.isArray(compare)) {
    return compare.map(toText).map((s) => s.trim()).filter((s) => s !== '');
  }
  return toText(compare)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function inRange(x, min, max, today) {
  if (isNumeric(x) && isNumeric(min) && isNumeric(max)) {
    const n = parseFloat(x);
    return n >= parseFloat(min) && n <= parseFloat(max);
  }
  const d = toDate(x, today);
  const lo = toDate(min, today);
  const hi = toDate(max, today);
  return d !== null && lo !== null && hi !== null && d >= lo && d <= hi;
}

/**
 * Whether one answer satisfies one operator.
 *
 * @param {*}      value    The answer (string, number, array, object, bool).
 * @param {string} operator Operator key.
 * @param {*}      compare  The rule's value.
 * @param {*}      compare2 Upper bound for "between".
 * @param {Object} opts     { today: 'YYYY-MM-DD' }.
 */
export function evaluateCondition(value, operator, compare, compare2, opts = {}) {
  const today = opts.today || localToday();
  const items = listOf(value);
  const c = toText(compare);

  switch (operator) {
    case 'equals':
      return items.some((x) => textEquals(x, c));
    case 'not_equals':
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
    case 'starts_with': {
      const needle = norm(c);
      return needle !== '' && items.some((x) => norm(x).startsWith(needle));
    }
    case 'ends_with': {
      const needle = norm(c);
      return needle !== '' && items.some((x) => norm(x).endsWith(needle));
    }
    case 'empty':
      return isEmptyValue(value);
    case 'not_empty':
      return !isEmptyValue(value);
    case 'greater_than':
      return isNumeric(c) && items.some((x) => isNumeric(x) && parseFloat(x) > parseFloat(c));
    case 'less_than':
      return isNumeric(c) && items.some((x) => isNumeric(x) && parseFloat(x) < parseFloat(c));
    case 'in':
    case 'not_in': {
      const opts2 = optionList(compare);
      const found =
        !isEmptyValue(value) &&
        items.some((x) => opts2.some((o) => textEquals(x, o)));
      return operator === 'in' ? found : !found;
    }
    case 'between': {
      let lo = compare;
      let hi = compare2;
      if (Array.isArray(compare) && compare.length === 2) {
        [lo, hi] = compare;
      }
      return items.some((x) => inRange(x, toText(lo), toText(hi), today));
    }
    case 'before':
    case 'after': {
      const limit = toDate(c, today);
      if (limit === null) return false;
      return items.some((x) => {
        const d = toDate(x, today);
        if (d === null) return false;
        return operator === 'before' ? d < limit : d > limit;
      });
    }
    default:
      return false;
  }
}

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

/** Whether a logic object's conditions are met. Inactive logic passes. */
export function logicPasses(logic, values, opts = {}) {
  const l = normalizeLogic(logic);
  if (!l) return true;
  return l.groups.some((g) => {
    const test = (r) =>
      evaluateCondition(readValue(values, r.field), r.operator, r.value, r.value2, opts);
    return g.match === 'any' ? g.rules.some(test) : g.rules.every(test);
  });
}

/** Whether a logic object has any rule to evaluate. */
export function hasLogic(logic) {
  return normalizeLogic(logic) !== null;
}

/**
 * All logic objects attached to a node: `logic` first, else the legacy
 * per-rule `conditions` grouped by effect.
 */
export function nodeLogics(node) {
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

function evaluateOnce(fields, values, opts) {
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

      nodeLogics(node).forEach((l) => {
        const passes = logicPasses(l, scope.values, opts);
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
    if (hasLogic(c.logic) && logicPasses(c.logic, values, opts)) {
      return c;
    }
  }
  return isPlainObject(meta.confirmation) ? meta.confirmation : {};
}

/**
 * Whether a logic object uses anything beyond the free basics.
 */
export function usesAdvancedLogic(logic) {
  const l = normalizeLogic(logic);
  if (!l) return false;
  if (l.groups.length > 1) return true;
  return l.groups.some(
    (g) => g.match === 'any' || g.rules.some((r) => ADVANCED_OPERATORS.includes(r.operator))
  );
}
