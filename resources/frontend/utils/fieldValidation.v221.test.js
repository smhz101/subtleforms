import { validateField, validateFields, isAnswerable } from './fieldValidation';
import { registerFieldType } from '../../shared/extend';

describe('fieldValidation 2.2.1', () => {
  test('required survives a partial config (bug 1)', () => {
    const field = { key: 'name', type: 'text', required: true, config: { appearance: { width: '50' } } };
    expect(validateField(field, '')).toBe('This field is required.');
  });

  test('fields that are not drawn are never required (bugs 8 and 9)', () => {
    expect(isAnswerable('checkbox_grid', { rows: [], columns: ['a'] })).toBe(false);
    expect(isAnswerable('checkbox_grid', { rows: ['r'], columns: ['c'] })).toBe(true);
    registerFieldType('qa_calc', { component: () => null, isAnswerable: (c) => !!String(c.formula || '').trim() });
    expect(isAnswerable('qa_calc', { formula: '' })).toBe(false);
    expect(isAnswerable('qa_calc', { formula: '1+1' })).toBe(true);
    const errors = validateFields(
      [
        { key: 'g', type: 'checkbox_grid', required: true, rows: [], columns: [] },
        { key: 'c', type: 'qa_calc', required: true, formula: ' ' },
      ],
      {},
      new Set()
    );
    expect(errors).toEqual({});
  });
});

describe('Chained Select with no dropdowns (RFUN-02)', () => {
  test('is not answerable and never required until it has choices', () => {
    expect(isAnswerable('chained_select', {})).toBe(false);
    expect(isAnswerable('chained_select', { levels: [{ label: 'A', options: [] }] })).toBe(false);
    expect(isAnswerable('chained_select', { options: [{ label: 'A', value: 'a' }] })).toBe(true);
    const unset = { key: 'p', type: 'chained_select', required: true };
    expect(validateFields([unset], {}, new Set())).toEqual({});
    const set = { ...unset, levels: [{ label: 'A', options: [{ label: 'x', value: 'x' }] }] };
    expect(Object.keys(validateFields([set], {}, new Set()))).toEqual(['p']);
  });
});

