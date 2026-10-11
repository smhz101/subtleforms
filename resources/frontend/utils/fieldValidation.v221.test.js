import { validateField, validateFields, isAnswerable } from './fieldValidation';

describe('fieldValidation 2.2.1', () => {
  test('required survives a partial config (bug 1)', () => {
    const field = { key: 'name', type: 'text', required: true, config: { appearance: { width: '50' } } };
    expect(validateField(field, '')).toBe('This field is required.');
  });

  test('fields that are not drawn are never required (bugs 8 and 9)', () => {
    expect(isAnswerable('checkbox_grid', { rows: [], columns: ['a'] })).toBe(false);
    expect(isAnswerable('checkbox_grid', { rows: ['r'], columns: ['c'] })).toBe(true);
    expect(isAnswerable('calculation', { formula: '' })).toBe(false);
    const errors = validateFields(
      [
        { key: 'g', type: 'checkbox_grid', required: true, rows: [], columns: [] },
        { key: 'c', type: 'calculation', required: true, formula: ' ' },
      ],
      {},
      new Set()
    );
    expect(errors).toEqual({});
  });
});
