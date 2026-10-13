import { fieldConfig, fieldKey } from './fieldConfig';

describe('fieldConfig (2.2.1 bug 1)', () => {
  test('a flat node is returned as is', () => {
    const field = { key: 'a', type: 'text', required: true };
    expect(fieldConfig(field)).toBe(field);
  });

  test('a partial config holding only appearance keeps required, options, placeholder and help', () => {
    const field = {
      key: 'pick',
      type: 'select',
      required: true,
      placeholder: 'Choose',
      description: 'Help',
      options: [{ label: 'A', value: 'a' }],
      config: { appearance: { width: '50' } },
    };
    const merged = fieldConfig(field);
    expect(merged.required).toBe(true);
    expect(merged.options).toHaveLength(1);
    expect(merged.placeholder).toBe('Choose');
    expect(merged.description).toBe('Help');
    expect(merged.appearance).toEqual({ width: '50' });
    expect(merged.config).toBeUndefined();
  });

  test('a wrapped node (builder shape) reads from config', () => {
    const merged = fieldConfig({ type: 'text', config: { key: 'k', required: true, label: 'L' } });
    expect(merged).toMatchObject({ type: 'text', key: 'k', required: true, label: 'L' });
  });

  test('empty values under config never hide real values on the node', () => {
    const merged = fieldConfig({ key: 'k', label: 'Name', options: [{ value: 1 }], config: { label: '', options: [] } });
    expect(merged.label).toBe('Name');
    expect(merged.options).toHaveLength(1);
  });

  test('appearance objects are merged key by key, config winning', () => {
    const merged = fieldConfig({ appearance: { width: '50', colorText: '#000' }, config: { appearance: { width: '33' } } });
    expect(merged.appearance).toEqual({ width: '33', colorText: '#000' });
  });

  test('fieldKey reads either shape', () => {
    expect(fieldKey({ key: 'a' })).toBe('a');
    expect(fieldKey({ config: { key: 'b' } })).toBe('b');
    expect(fieldKey(null)).toBeUndefined();
  });
});
