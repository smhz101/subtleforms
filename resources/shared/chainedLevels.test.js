import {
  addChoice,
  choicesForParent,
  levelsFromIndented,
  removeChoice,
} from './chainedLevels';

const sample = [
  {
    label: 'Country',
    options: [
      { label: 'USA', value: 'usa' },
      { label: 'Pakistan', value: 'pakistan' },
    ],
  },
  {
    label: 'State',
    options: [
      { label: 'California', value: 'california', parent: 'usa' },
      { label: 'Punjab', value: 'punjab', parent: 'pakistan' },
    ],
  },
  {
    label: 'City',
    options: [
      { label: 'Lahore', value: 'lahore', parent: 'punjab' },
      { label: 'Rawalpindi', value: 'rawalpindi', parent: 'punjab' },
    ],
  },
];

describe('chained dropdown editing', () => {
  test('a later dropdown only lists choices for the selected parent', () => {
    expect(choicesForParent(sample, 1, 'pakistan').map((option) => option.value)).toEqual(['punjab']);
    expect(choicesForParent(sample, 1, '')).toEqual([]);
    expect(choicesForParent(sample, 0, '').map((option) => option.value)).toEqual(['usa', 'pakistan']);
  });

  test('removing a parent removes the choices that depended on it', () => {
    const next = removeChoice(sample, 0, 'pakistan');
    expect(next[0].options.map((option) => option.value)).toEqual(['usa']);
    expect(next[1].options.map((option) => option.value)).toEqual(['california']);
    expect(next[2].options).toEqual([]);
  });

  test('a new choice is unique on that dropdown', () => {
    const next = addChoice(sample, 1, 'pakistan');
    const added = next[1].options[next[1].options.length - 1];
    expect(added.parent).toBe('pakistan');
    expect(next[1].options.filter((option) => option.value === added.value)).toHaveLength(1);
  });

  test('an indented list becomes parent and child dropdowns', () => {
    const levels = levelsFromIndented(
      ['USA', '  California', '    Los Angeles', 'Pakistan', '  Punjab', '    Lahore'].join('\n'),
      [{ label: 'Country' }, { label: 'State' }, { label: 'City' }]
    );
    expect(levels.map((level) => level.label)).toEqual(['Country', 'State', 'City']);
    expect(levels[1].options.find((option) => option.label === 'Punjab').parent).toBe('pakistan');
    expect(levels[2].options.find((option) => option.label === 'Lahore').parent).toBe('punjab');
    expect(levels[2].options.find((option) => option.label === 'Los Angeles').parent).toBe('california');
  });

  test('two children with the same name get different values', () => {
    const levels = levelsFromIndented(['USA', '  Springfield', 'Canada', '  Springfield'].join('\n'));
    const values = levels[1].options.map((option) => option.value);
    expect(new Set(values).size).toBe(2);
  });
});
