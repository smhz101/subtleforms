import { denormalizeTree, normalizeSchema } from './schemaTree';

function roundTrip(fields) {
  return denormalizeTree(normalizeSchema({ fields }));
}

describe('schemaTree matrix and choice round trip', () => {
  it('keeps checkbox_grid row and column labels', () => {
    const [field] = roundTrip([
      {
        id: 'matrix_1',
        type: 'checkbox_grid',
        label: 'Grid',
        rows: ['A'],
        columns: ['X', 'Y'],
      },
    ]);

    expect(field.rows).toEqual(['A']);
    expect(field.columns).toEqual(['X', 'Y']);
  });

  it('keeps layout column container children', () => {
    const [field] = roundTrip([
      {
        id: 'cols_1',
        type: 'two_column_container',
        columns: [
          [{ id: 'left_1', type: 'text', label: 'Left' }],
          [{ id: 'right_1', type: 'text', label: 'Right' }],
        ],
      },
    ]);

    expect(field.columns).toHaveLength(2);
    expect(field.columns[0][0]).toEqual(expect.objectContaining({
      id: 'left_1',
      type: 'text',
      label: 'Left',
    }));
    expect(field.columns[1][0]).toEqual(expect.objectContaining({
      id: 'right_1',
      type: 'text',
      label: 'Right',
    }));
  });

  it('keeps dropdown options', () => {
    const [field] = roundTrip([
      {
        id: 'drop_1',
        type: 'dropdown',
        label: 'Pick',
        options: [{ label: 'One', value: 'one' }],
      },
    ]);

    expect(field.options).toEqual([{ label: 'One', value: 'one' }]);
  });

  it('keeps chained_select levels and nested options', () => {
    const levels = [
      {
        label: 'Country',
        options: [{ label: 'USA', value: 'usa' }],
      },
      {
        label: 'State',
        options: [{ label: 'CA', value: 'ca' }],
      },
    ];

    const [field] = roundTrip([
      {
        id: 'chain_1',
        type: 'chained_select',
        label: 'Place',
        levels,
      },
    ]);

    expect(field.levels).toEqual(levels);
  });
});
