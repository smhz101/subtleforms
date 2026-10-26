import { getMissingAddonFields, getFieldDisplayName } from './addonFields';

const known = ['text', 'email', 'step', 'two_column_container'];

describe('fields no active plugin registers', () => {
  const schema = {
    fields: [
      { type: 'text', key: 'name', label: 'Name' },
      { type: 'step', children: [{ type: 'add_on_one', key: 'one', label: 'Your signature' }] },
      { type: 'two_column_container', columns: [{ fields: [{ type: 'add_on_two', key: 'two', config: { label: 'Total' } }] }] },
    ],
  };

  test('names the fields as the form author wrote them', () => {
    expect(getMissingAddonFields(schema, known)).toEqual(['Your signature', 'Total']);
  });

  test('falls back to the type key when a field has no name', () => {
    expect(getMissingAddonFields({ fields: [{ type: 'seating_chart', key: 's' }] }, known)).toEqual(['seating_chart']);
    expect(getFieldDisplayName({ type: 'seating_chart', label: '  ' })).toBe('seating_chart');
  });

  test('says nothing when every type is registered, or when the server gave no list', () => {
    expect(getMissingAddonFields(schema, [...known, 'add_on_one', 'add_on_two'])).toEqual([]);
    expect(getMissingAddonFields(schema, [])).toEqual([]);
    expect(getMissingAddonFields(null, known)).toEqual([]);
  });

  test('ignores payment settings: only registered field types decide', () => {
    const toggleOnly = { metadata: { type: 'conversational', payment: { enabled: true } }, fields: [{ type: 'email', key: 'e' }] };
    expect(getMissingAddonFields(toggleOnly, known)).toEqual([]);
  });

  test('reads the known types from the page data by default', () => {
    window.subtleformsAdmin = { knownFieldTypes: known };
    expect(getMissingAddonFields(schema)).toEqual(['Your signature', 'Total']);
    delete window.subtleformsAdmin;
  });
});

describe('settings a form uses that an inactive add-on provides', () => {
  const { getLimitedFeatures } = require('./addonFields');
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
