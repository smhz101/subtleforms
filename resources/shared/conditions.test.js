/**
 * Conditional logic: browser half of the shared spec.
 *
 * The cases live in tests/fixtures/conditional-logic.json, which the PHPUnit
 * suite (tests/unit/ConditionalLogicTest.php) also runs.
 */
import spec from '../../tests/fixtures/conditional-logic.json';
// A form with a Country rule always has the country list on the page.
import './countries';
import { registerLogicExtension, getLogicExtensions } from './extend';
import {
  evaluateCondition,
  logicPasses,
  computeLogicState,
  pickConfirmation,
  hasLogic,
  visibleValues,
  hiddenNodes,
} from './conditions';

const opts = { today: spec.today };
const sorted = (a) => [...a].sort();

describe('conditional logic spec: conditions', () => {
  test.each(spec.conditions.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(
      evaluateCondition(c.value, c.operator, c.compare ?? '', c.compare2 ?? '', { ...opts, field: c.field })
    ).toBe(c.expected);
  });
});

describe('conditional logic spec: logic', () => {
  test.each(spec.logic.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(logicPasses(c.logic, c.values, opts)).toBe(c.expected);
  });
});

describe('conditional logic spec: form state', () => {
  test.each(spec.state.map((c) => [c.name, c]))('%s', (_name, c) => {
    const state = computeLogicState(c.schema, c.values, opts);
    ['hidden_fields', 'required_fields', 'hidden_steps'].forEach((k) => {
      expect(sorted(state[k])).toEqual(sorted(c.expected[k]));
    });
  });
});

describe('conditional logic spec: confirmations', () => {
  test.each(spec.confirmations.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(pickConfirmation(c.metadata, c.values, opts).id ?? null).toBe(c.expected);
  });
});

// Logic the plugin does not evaluate (SubtleForms Pro does) is ignored.
describe('conditional logic spec: unsupported logic is ignored', () => {
  test.each(spec.ignored.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(logicPasses(c.logic, c.values, opts, c.scope)).toBe(c.expected);
    expect(hasLogic(c.logic, c.scope)).toBe(false);
  });

  test.each(spec.ignoredState.map((c) => [c.name, c]))('%s', (_name, c) => {
    const state = computeLogicState(c.schema, c.values, opts);
    ['hidden_fields', 'required_fields', 'hidden_steps'].forEach((k) => {
      expect(sorted(state[k])).toEqual(sorted(c.expected[k]));
    });
  });
});

describe('logic extensions', () => {
  afterEach(() => {
    getLogicExtensions().length = 0;
  });

  const stepLogic = {
    action: 'show',
    groups: [{ match: 'any', rules: [{ field: 'a', operator: 'starts_with', value: 'x' }] }],
  };

  test('an add-on that claims a scope evaluates it', () => {
    registerLogicExtension({
      supports: (l, scope) => scope === 'step',
      passes: (l, values) => values.a === 'go',
    });
    expect(hasLogic(stepLogic, 'step')).toBe(true);
    expect(hasLogic(stepLogic, 'action')).toBe(false);
    expect(logicPasses(stepLogic, { a: 'go' }, opts, 'step')).toBe(true);
    expect(logicPasses(stepLogic, { a: 'no' }, opts, 'step')).toBe(false);
  });

  test('an add-on evaluates an operator the plugin does not know', () => {
    registerLogicExtension({
      evaluateCondition: (value, operator, compare, compare2, o, helpers) =>
        operator === 'starts_with' ? helpers.norm(value).startsWith(helpers.norm(compare)) : null,
    });
    expect(evaluateCondition('SF-1', 'starts_with', 'sf-', '', opts)).toBe(true);
    expect(evaluateCondition('X', 'starts_with', 'sf-', '', opts)).toBe(false);
    expect(evaluateCondition('X', 'mystery', 'sf-', '', opts)).toBe(false);
  });

  test('a broken add-on never stops the form', () => {
    registerLogicExtension({
      supports: () => true,
      passes: () => {
        throw new Error('boom');
      },
    });
    expect(logicPasses(stepLogic, { a: 'x' }, opts, 'step')).toBe(true);
  });
});

test('visibleValues drops hidden answers', () => {
  const out = visibleValues(spec.state[0].schema, { plan: 'business', seats: '3', invoice: 'stale' }, opts);
  expect(out).toEqual({ plan: 'business', seats: '3' });
});

describe('hiddenNodes (nodes that logic hides, with or without a key)', () => {
  // Logic on a step belongs to an add-on; this one claims the step scope.
  beforeEach(() => {
    registerLogicExtension({
      supports: (l, scope) => scope === 'step',
      passes: (l, values) => values.plan === 'yes',
    });
  });
  afterEach(() => {
    getLogicExtensions().length = 0;
  });

  const rule = { action: 'show', groups: [{ match: 'all', rules: [{ field: 'plan', operator: 'equals', value: 'yes' }] }] };
  const keyed = { type: 'payment_hidden_price', key: 'fee_keyed', config: { amount: 5 } };
  const keyless = { type: 'payment_hidden_price', config: { amount: 7 } };
  const step2 = { type: 'step', id: 'step_2', logic: rule, children: [keyed, keyless] };
  const own = { type: 'payment_hidden_price', config: { amount: 9, logic: rule } };
  const schema = { fields: [{ type: 'step', id: 'step_1', children: [{ type: 'text', key: 'plan' }, own] }, step2] };

  test('a skipped step hides its keyed and keyless fields', () => {
    const { nodes, keys } = hiddenNodes(schema, { plan: 'no' });
    expect(nodes.has(keyed)).toBe(true);
    expect(nodes.has(keyless)).toBe(true);
    expect(keys.has('fee_keyed')).toBe(true);
    expect(keys.has('step_2')).toBe(true);
  });

  test('a keyless field with its own rule is judged by that rule', () => {
    expect(hiddenNodes(schema, { plan: 'no' }).nodes.has(own)).toBe(true);
    expect(hiddenNodes(schema, { plan: 'yes' }).nodes.has(own)).toBe(false);
  });

  test('nothing is hidden when the rules pass', () => {
    expect(hiddenNodes(schema, { plan: 'yes' }).nodes.size).toBe(0);
  });
});
