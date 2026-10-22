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

describe('features a form uses that need Pro to work in full', () => {
  const { getLimitedFeatures } = require('./proFeatureDetector');
  const rule = (extra = {}) => ({ field: 'a', operator: 'equals', value: '1', ...extra });
  const logic = (groups) => ({ action: 'show', groups });

  test('a plain form lists nothing', () => {
    expect(getLimitedFeatures({ fields: [{ type: 'text', key: 'a', logic: logic([{ match: 'all', rules: [rule()] }]) }] }, [])).toEqual([]);
  });

  test('finds Picture Choice, a multi-file upload and advanced logic at any depth', () => {
    const schema = {
      fields: [
        {
          type: 'step',
          children: [
            { type: 'picture_choice', key: 'p' },
            { type: 'file_upload', key: 'u', multiple: true },
            { type: 'text', key: 't', config: { logic: logic([{ match: 'any', rules: [rule()] }]) } },
          ],
        },
      ],
    };
    expect(getLimitedFeatures(schema, [])).toEqual([
      'Picture Choice (shown without pictures)',
      'Several files per upload (one file is accepted)',
      'Advanced conditional logic (ignored)',
    ]);
  });

  test('a rule on a step, an action or a confirmation counts as advanced logic', () => {
    const basic = logic([{ match: 'all', rules: [rule()] }]);
    expect(getLimitedFeatures({ fields: [{ type: 'step', logic: basic }] }, [])).toHaveLength(1);
    expect(getLimitedFeatures({ fields: [], actions: [{ settings: { logic: basic } }] }, [])).toHaveLength(1);
    expect(getLimitedFeatures({ fields: [], metadata: { confirmations: [{ logic: basic }] } }, [])).toHaveLength(1);
  });

  test('says nothing for a feature an add-on provides', () => {
    const schema = { fields: [{ type: 'picture_choice', key: 'p' }, { type: 'image_upload', key: 'u', multiple: true }] };
    expect(getLimitedFeatures(schema, ['picture_choice', 'multi_file_uploads'])).toEqual([]);
    expect(getLimitedFeatures(schema, ['picture_choice'])).toHaveLength(1);
  });
});
