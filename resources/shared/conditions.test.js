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
