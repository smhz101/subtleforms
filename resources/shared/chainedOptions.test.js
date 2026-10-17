import { chainedSelectLevels, nextChainedSelections } from './chainedOptions';

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
});
