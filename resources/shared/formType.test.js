import {
  structuralType,
  withStructuralType,
  wrapFieldsInStep,
  flattenSteps,
  normalizeType,
  hasSteps,
} from './formType';

const text = (key) => ({ type: 'text', key, label: key.toUpperCase() });

describe('form type follows structure (2.3.2 item 1)', () => {
  it('a Standard form with a Page Break is Multi-step', () => {
    expect(structuralType({ metadata: { type: 'regular' }, fields: [{ type: 'step', key: 's', children: [] }] })).toBe('multi-step');
    expect(structuralType({ metadata: {}, fields: [{ type: 'step', key: 's' }] })).toBe('multi-step');
  });

  it('a Multi-step form without Page Breaks is Standard', () => {
    expect(structuralType({ metadata: { type: 'multi-step' }, fields: [text('a')] })).toBe('regular');
    expect(structuralType({ metadata: { type: 'multistep' }, fields: [] })).toBe('regular');
  });

  it('Conversational and add-on types are never changed', () => {
    expect(structuralType({ metadata: { type: 'conversational' }, fields: [{ type: 'step', key: 's' }] })).toBe('conversational');
    expect(structuralType({ metadata: { type: 'payment' }, fields: [] })).toBe('payment');
  });

  it('withStructuralType returns the same object when nothing changes', () => {
    const s = { metadata: { type: 'regular' }, fields: [text('a')] };
    expect(withStructuralType(s)).toBe(s);
    expect(withStructuralType({ metadata: { type: 'regular' }, fields: [{ type: 'step' }] }).metadata.type).toBe('multi-step');
  });

  it('wrapFieldsInStep keeps every field, in order, in a first step', () => {
    const fields = [text('a'), text('b'), text('c')];
    const wrapped = wrapFieldsInStep(fields, { key: 'step_1', title: 'Step 1' });
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0]).toMatchObject({ type: 'step', key: 'step_1', title: 'Step 1' });
    expect(wrapped[0].children.map((f) => f.key)).toEqual(['a', 'b', 'c']);
    expect(hasSteps(wrapped)).toBe(true);
    // Already multi-step: unchanged.
    expect(wrapFieldsInStep(wrapped, { key: 'x' })).toBe(wrapped);
  });

  it('flattenSteps keeps every field in order (children and legacy fields)', () => {
    const fields = [
      { type: 'step', key: 's1', children: [text('a'), text('b')] },
      { type: 'step', key: 's2', fields: [text('c')] },
      { type: 'step', key: 's3', children: [] },
      text('orphan'),
    ];
    expect(flattenSteps(fields).map((f) => f.key)).toEqual(['a', 'b', 'c', 'orphan']);
  });

  it('normalizes spellings', () => {
    expect(normalizeType('sectioned')).toBe('multi-step');
    expect(normalizeType('')).toBe('regular');
    expect(normalizeType('Conversational')).toBe('conversational');
  });
});
