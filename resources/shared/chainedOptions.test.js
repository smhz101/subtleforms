import { chainedPresentation, chainedSelectLevels, nextChainedSelections } from './chainedOptions';

describe('chained select options', () => {
  test('two levels with options produce more than one row', () => {
    const rows = chainedSelectLevels({
      levels: [
        { label: 'Country', options: [{ label: 'United States', value: 'us' }] },
        { label: 'State', options: [{ label: 'California', value: 'ca' }] },
      ],
    });
    expect(rows.length).toBeGreaterThan(1);
  });

  test('changing a parent drops the choices below it', () => {
    expect(nextChainedSelections(['us', 'ca'], 0, 'ca')).toEqual(['ca']);
  });

  test('a later dropdown only lists choices for the selected parent', () => {
    const rows = chainedSelectLevels({
      levels: [
        {
          label: 'Make',
          options: [
            { label: 'Toyota', value: 'toyota' },
            { label: 'Honda', value: 'honda' },
          ],
        },
        {
          label: 'Model',
          options: [
            { label: 'Camry', value: 'camry', parent: 'toyota' },
            { label: 'Civic', value: 'civic', parent: 'honda' },
          ],
        },
      ],
    }, ['toyota']);
    expect(rows).toHaveLength(2);
    expect(rows[1].options.map((opt) => opt.value)).toEqual(['camry']);
  });

  test('the next dropdown stays hidden until a parent is chosen', () => {
    const rows = chainedSelectLevels({
      levels: [
        { label: 'Make', options: [{ label: 'Toyota', value: 'toyota' }] },
        { label: 'Model', options: [{ label: 'Camry', value: 'camry', parent: 'toyota' }] },
      ],
    }, []);
    expect(rows).toHaveLength(1);
  });
});

test('an unknown presentation stays dropdowns', () => {
  expect(chainedPresentation({ presentation: 'buttons' })).toBe('buttons');
  expect(chainedPresentation({ presentation: 'columns' })).toBe('columns');
  expect(chainedPresentation({})).toBe('dropdowns');
  expect(chainedPresentation({ presentation: 'map' })).toBe('dropdowns');
});
