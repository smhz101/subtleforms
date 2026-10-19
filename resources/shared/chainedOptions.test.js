import {
  chainedPresentation,
  firstUnansweredChainedLevel,
  chainedSelectLevels,
  defaultChainedColumnSelections,
  nextChainedSelections,
} from './chainedOptions';

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

test('columns keep every list, including one with nothing to show', () => {
  const config = {
    levels: [
      { label: 'Group', options: [{ label: 'Alpha', value: 'alpha' }, { label: 'Beta', value: 'beta' }] },
      {
        label: 'Item',
        options: [
          { label: 'One', value: 'one', parent: 'alpha' },
          { label: 'Two', value: 'two', parent: 'beta' },
        ],
      },
      { label: 'Detail', options: [{ label: 'Small', value: 'small', parent: 'one' }] },
    ],
  };
  const selections = defaultChainedColumnSelections(config, []);
  expect(selections).toEqual(['alpha']);
  const rows = chainedSelectLevels(config, selections, { includeEmpty: true });
  expect(rows).toHaveLength(3);
  expect(rows[1].options.map((opt) => opt.value)).toEqual(['one']);
  expect(rows[2].options).toEqual([]);
  expect(defaultChainedColumnSelections(config, ['beta'])).toEqual(['beta']);
});

describe('firstUnansweredChainedLevel (FLD2-10)', () => {
  const config = {
    levels: [
      { label: 'Make', options: [{ label: 'Toyota', value: 'toyota' }, { label: 'Kia', value: 'kia' }] },
      { label: 'Model', options: [{ label: 'Corolla', value: 'corolla', parent: 'toyota' }] },
    ],
  };

  it('needs every level that offers choices', () => {
    expect(firstUnansweredChainedLevel(config, [])).toBe(0);
    expect(firstUnansweredChainedLevel(config, ['toyota'])).toBe(1);
    expect(firstUnansweredChainedLevel(config, ['toyota', 'corolla'])).toBe(-1);
  });

  it('does not ask for a level with no choices for the answer', () => {
    expect(firstUnansweredChainedLevel(config, ['kia'])).toBe(-1);
  });

  it('does not count an answer that is not a choice', () => {
    expect(firstUnansweredChainedLevel(config, ['toyota', 'civic'])).toBe(1);
  });
});
