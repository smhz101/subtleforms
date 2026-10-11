/**
 * Conditional logic: browser half of the shared spec.
 *
 * The cases live in tests/fixtures/conditional-logic.json, which the PHPUnit
 * suite (tests/unit/ConditionalLogicTest.php) also runs.
 */
import spec from '../../tests/fixtures/conditional-logic.json';
import {
  evaluateCondition,
  logicPasses,
  computeLogicState,
  pickConfirmation,
  usesAdvancedLogic,
  visibleValues,
} from './conditions';

const opts = { today: spec.today };
const sorted = (a) => [...a].sort();

describe('conditional logic spec: conditions', () => {
  test.each(spec.conditions.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(
      evaluateCondition(c.value, c.operator, c.compare ?? '', c.compare2 ?? '', opts)
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

describe('conditional logic spec: advanced detection', () => {
  test.each(spec.advanced.map((c) => [c.name, c]))('%s', (_name, c) => {
    expect(usesAdvancedLogic(c.logic)).toBe(c.expected);
  });
});

test('visibleValues drops hidden answers', () => {
  const out = visibleValues(spec.state[0].schema, { plan: 'business', seats: '3', invoice: 'stale' }, opts);
  expect(out).toEqual({ plan: 'business', seats: '3' });
});
