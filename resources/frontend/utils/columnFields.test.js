import { columnFields, flattenSchemaFields } from './columnFields';

describe('columnFields', () => {
  const product = { type: 'payment_product', key: 'plan', config: { price: 12 } };

  test('reads a list of fields', () => {
    expect(columnFields([product])).toEqual([product]);
  });

  test('reads fields or children on a column object', () => {
    expect(columnFields({ fields: [product] })).toEqual([product]);
    expect(columnFields({ children: [product] })).toEqual([product]);
  });

  test('is empty for anything else', () => {
    expect(columnFields(null)).toEqual([]);
    expect(columnFields({ label: 'Side' })).toEqual([]);
  });
});

describe('flattenSchemaFields', () => {
  test('includes a fixed product stored as columns[{ fields }]', () => {
    const product = { type: 'payment_product', key: 'plan', config: { key: 'plan', price: 12 } };
    const flat = flattenSchemaFields([
      {
        type: 'two_column_container',
        key: 'cols',
        columns: [{ fields: [product] }],
      },
    ]);
    expect(flat.map((field) => field.key)).toContain('plan');
  });

  test('still flattens a column that is a list, and skips steps', () => {
    const flat = flattenSchemaFields([
      {
        type: 'step',
        id: 's1',
        columns: [[{ type: 'text', key: 'name' }]],
      },
    ]);
    expect(flat.map((field) => field.type)).toEqual(['text']);
  });
});

describe('object columns reach validation and the input list', () => {
  // Review #20: the server prices a product in columns: [{ fields: [...] }].
  // The form must render, validate and submit the same fields.
  const { validateFields } = require('./fieldValidation');
  const { collectLeafInputPaths } = require('./schemaLeaves');
  const { collectDefaultValues } = require('./defaults');
  const schema = [
    {
      type: 'two_column_container',
      key: 'cols',
      columns: [
        { fields: [{ type: 'text', key: 'side_note', config: { key: 'side_note', required: true } }] },
        { children: [{ type: 'text', key: 'other', config: { key: 'other', defaultValue: 'x' } }] },
      ],
    },
  ];

  test('a required field in an object column is validated', () => {
    expect(validateFields(schema, {}, new Set())).toHaveProperty('side_note');
  });

  test('fields in object columns are inputs and get defaults', () => {
    expect(collectLeafInputPaths(schema)).toEqual(expect.arrayContaining(['side_note', 'other']));
    expect(collectDefaultValues(schema)).toHaveProperty('other', 'x');
  });
});
