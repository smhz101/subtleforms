/**
 * QA-09: Repeater values, per-group validation and per-group logic in the
 * browser (mirrors tests/unit/RepeaterTest.php).
 */
import { validateFields, repeaterLimits } from './fieldValidation';
import { collectDefaultValues } from './defaults';
import { setIn, getIn, deleteIn } from './valuePaths';
import { collectLeafInputPaths, collectContainerKeys } from './schemaLeaves';
import { computeLogicState, visibleValues, repeaterGroups } from '../../shared/conditions';

const repeater = (extra = []) => ({
  type: 'repeat_container',
  key: 'companies',
  label: 'Companies',
  min: 1,
  max: 3,
  children: [
    { type: 'text', key: 'ticker', label: 'Ticker', required: true },
    { type: 'number', key: 'shares', label: 'Shares', min: 1, defaultValue: '1' },
    ...extra,
  ],
});

describe('Repeater values', () => {
  it('setIn keeps groups as arrays and getIn reads them', () => {
    let values = {};
    values = setIn(values, 'companies.0.ticker', 'AAPL');
    values = setIn(values, 'companies.1.ticker', 'MSFT');
    expect(Array.isArray(values.companies)).toBe(true);
    expect(getIn(values, 'companies.1.ticker')).toBe('MSFT');
  });

  it('deleteIn removes one group answer without touching the others', () => {
    const values = { companies: [{ ticker: 'A', why: 'x' }, { ticker: 'B', why: 'y' }] };
    const next = deleteIn(values, 'companies.0.why');
    expect(next.companies[0]).toEqual({ ticker: 'A' });
    expect(next.companies[1]).toEqual({ ticker: 'B', why: 'y' });
    expect(values.companies[0].why).toBe('x');
  });

  it('starts with the minimum groups and the children defaults', () => {
    expect(collectDefaultValues([repeater()])).toEqual({ companies: [{ shares: '1' }] });
    expect(collectDefaultValues([{ ...repeater(), min: 2 }]).companies).toHaveLength(2);
  });

  it('is one leaf answer, not a container, and its children are not top-level', () => {
    expect(collectLeafInputPaths([repeater()])).toEqual(['companies']);
    expect(collectContainerKeys([repeater()]).has('companies')).toBe(false);
  });

  it('reads limits like the server', () => {
    expect(repeaterLimits({ min: 1, max: 3 })).toEqual({ min: 1, max: 3 });
    expect(repeaterLimits({})).toEqual({ min: 1, max: 5 });
    expect(repeaterLimits({ min: 4, max: 2 })).toEqual({ min: 4, max: 4 });
  });
});

describe('Repeater validation', () => {
  it('checks every group on its own', () => {
    const errors = validateFields(
      [repeater()],
      { companies: [{ ticker: 'AAPL', shares: '2' }, { ticker: '', shares: '0' }] },
      new Set()
    );
    expect(Object.keys(errors).sort()).toEqual(['companies.1.shares', 'companies.1.ticker']);
  });

  it('checks the minimum groups even when nothing is stored', () => {
    expect(Object.keys(validateFields([repeater()], {}, new Set()))).toEqual(['companies.0.ticker']);
  });

  it('reports too many groups', () => {
    const errors = validateFields([repeater()], { companies: [{ ticker: 'a' }, { ticker: 'b' }, { ticker: 'c' }, { ticker: 'd' }] }, new Set());
    expect(errors.companies).toMatch(/no more than 3/);
  });

  it('skips hidden group fields', () => {
    const errors = validateFields([repeater()], { companies: [{}] }, new Set(['companies.0.ticker']));
    expect(errors).toEqual({});
  });
});

describe('Repeater conditional logic', () => {
  const schema = {
    fields: [
      repeater([
        {
          type: 'text',
          key: 'reason',
          label: 'Reason',
          required: true,
          logic: { action: 'show', groups: [{ match: 'all', rules: [{ field: 'ticker', operator: 'equals', value: 'OTHER' }] }] },
        },
      ]),
    ],
  };

  it('evaluates each group with its own answers', () => {
    const values = { companies: [{ ticker: 'AAPL' }, { ticker: 'OTHER' }] };
    const state = computeLogicState(schema, values);
    expect(state.hidden_fields).toContain('companies.0.reason');
    expect(state.hidden_fields).not.toContain('companies.1.reason');
    const errors = validateFields(schema.fields, values, new Set(state.hidden_fields));
    expect(errors['companies.1.reason']).toBeTruthy();
    expect(errors['companies.0.reason']).toBeUndefined();
  });

  it('drops hidden group answers like the server', () => {
    const values = { companies: [{ ticker: 'AAPL', reason: 'old' }, { ticker: 'OTHER', reason: 'keep' }] };
    const visible = visibleValues(schema, values);
    expect(visible.companies[0]).toEqual({ ticker: 'AAPL' });
    expect(visible.companies[1].reason).toBe('keep');
  });

  it('normalises posted groups', () => {
    expect(repeaterGroups(undefined)).toEqual([{}]);
    expect(repeaterGroups({ 1: { a: 2 }, 0: { a: 1 } })).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
