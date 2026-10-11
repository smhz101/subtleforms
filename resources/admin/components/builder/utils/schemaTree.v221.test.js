import { normalizeSchema, denormalizeTree } from './schemaTree';

describe('schemaTree 2.2.1', () => {
  test('a single checkbox with options becomes Multiple choice (pick any) with a notice (bug 7)', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [
        { id: 'c1', key: 'extras', type: 'checkbox', label: 'Extras', checkboxLabel: 'I agree', options: [{ label: 'A', value: 'a' }] },
        { id: 'c2', key: 'agree', type: 'checkbox', label: 'Agree' },
      ],
    });
    const [extras, agree] = denormalizeTree(tree);
    expect(extras.type).toBe('multiple_choice');
    expect(extras.allowMultiple).toBe(true);
    expect(extras.options).toHaveLength(1);
    expect(extras.checkboxLabel).toBeUndefined();
    expect(agree.type).toBe('checkbox');
    expect(tree.conversions).toEqual([{ key: 'extras', label: 'Extras', from: 'checkbox', to: 'multiple_choice' }]);
  });

  test('a stray partial config is folded into the node and not saved again (bug 1)', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [
        {
          id: 's1',
          key: 'pick',
          type: 'select',
          label: 'Pick',
          required: true,
          options: [{ label: 'A', value: 'a' }],
          config: { appearance: { width: '50' } },
        },
      ],
    });
    const [pick] = denormalizeTree(tree);
    expect(pick.config).toBeUndefined();
    expect(pick.required).toBe(true);
    expect(pick.options).toHaveLength(1);
    expect(pick.appearance).toEqual({ width: '50' });
  });
});
