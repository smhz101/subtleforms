import { formUsesProFeatures, getProFeaturesUsed, getMissingAddonFields } from './proFeatureDetector';

const schema = {
  fields: [
    { type: 'text', key: 'name' },
    { type: 'step', children: [{ type: 'signature', key: 'sig' }] },
    { type: 'two_column_container', columns: [{ fields: [{ type: 'calculation', key: 'total' }] }] },
  ],
};

describe('add-on field detection (2.3.9, PRO-09)', () => {
  test('finds Pro field types at any depth', () => {
    expect(formUsesProFeatures(schema)).toBe(true);
    expect(getProFeaturesUsed(schema)).toEqual(['Signature', 'Calculation']);
    expect(formUsesProFeatures({ fields: [{ type: 'picture_choice' }, { type: 'payment_product' }] })).toBe(false);
  });

  test('names only the add-on fields this site cannot show', () => {
    expect(getMissingAddonFields(schema, ['signature', 'calculation', 'payment_card'])).toEqual(['Signature', 'Calculation']);
    expect(getMissingAddonFields(schema, [])).toEqual([]);
  });
});
