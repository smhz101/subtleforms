import {
  addChoice,
  CHAINED_EXAMPLE_CSV,
  chainedUsesCsv,
  choicesForParent,
  levelsFromCsv,
  levelsFromIndented,
  levelsToCsv,
  removeChoice,
  renameChoice,
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

  test('a dropdown with no parent links keeps every choice', () => {
    const legacy = [
      { label: 'Group', options: [{ label: 'One', value: 'one' }] },
      { label: 'Item', options: [{ label: 'Two', value: 'two' }, { label: 'Three', value: 'three' }] },
    ];
    expect(choicesForParent(legacy, 1, '').map((option) => option.value)).toEqual(['two', 'three']);
    expect(choicesForParent(legacy, 1, 'one').map((option) => option.value)).toEqual(['two', 'three']);
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

test('a csv file becomes dependent dropdowns', () => {
  const levels = levelsFromCsv(CHAINED_EXAMPLE_CSV);
  expect(levels.map((level) => level.label)).toEqual([
    'First dropdown',
    'Second dropdown',
    'Third dropdown',
  ]);
  const small = levels[2].options.find((option) => option.label === 'Small' && option.parent);
  const one = levels[1].options.find((option) => option.value === small.parent);
  expect(one.label).toBe('One');
  expect(one.parent).toBe('alpha');
  const again = levelsFromCsv(levelsToCsv(levels));
  expect(again[2].options.map((option) => option.label).sort()).toEqual(
    levels[2].options.map((option) => option.label).sort()
  );
});

test('an empty csv does not wipe dropdowns', () => {
  expect(levelsFromCsv('First dropdown\n')).toBeNull();
  expect(levelsFromCsv('')).toBeNull();
});

test('typed lists stay editable when an old field still says csv', () => {
  expect(
    chainedUsesCsv({
      source: 'csv',
      levels: [{ label: 'Group', options: [{ label: 'One', value: 'one' }] }],
    })
  ).toBe(false);
  expect(chainedUsesCsv({ source: 'csv', sourceChosen: true, levels: [] })).toBe(true);
  expect(chainedUsesCsv({ source: 'manual', sourceChosen: true })).toBe(false);
});

test('csv cells can contain commas', () => {
  const levels = levelsFromCsv('Group,Choice\n"A, B",One\n');
  expect(levels[0].options[0].label).toBe('A, B');
  expect(levels[1].options[0].parent).toBe('a_b');
});

describe('readable identifiers that are never reused (FLD2-02, FLD2-03)', () => {
  const make = { label: 'Make', options: [] };

  test('a typed choice takes its identifier from its label', () => {
    let levels = addChoice([make], 0);
    const draft = levels[0].options[0].value;
    levels = renameChoice(levels, 0, draft, 'F', { rekey: true });
    levels = renameChoice(levels, 0, 'f', 'Ford', { rekey: true });
    expect(levels[0].options[0]).toEqual({ label: 'Ford', value: 'ford' });
  });

  test('a saved choice keeps its identifier when renamed', () => {
    const levels = renameChoice([{ label: 'Make', options: [{ label: 'Ford', value: 'ford' }] }], 0, 'ford', 'Ford Motor');
    expect(levels[0].options[0].value).toBe('ford');
  });

  test('later choices follow a parent whose identifier changes', () => {
    const levels = [
      { label: 'Make', options: [{ label: 'Choice 1', value: 'choice_abc12345' }] },
      { label: 'Model', options: [{ label: 'Focus', value: 'focus', parent: 'choice_abc12345' }] },
    ];
    const next = renameChoice(levels, 0, 'choice_abc12345', 'Ford', { rekey: true });
    expect(next[1].options[0].parent).toBe('ford');
  });

  test('Urdu and Chinese labels give readable identifiers', () => {
    const levels = levelsFromCsv(['شہر,城市', 'لاہور,北京'].join('\n'));
    expect(levels[0].options[0].value).toBe('لاہور');
    expect(levels[1].options[0].value).toBe('北京');
  });

  test('a new choice never takes the identifier of a removed one', () => {
    let levels = [{ label: 'Make', options: [] }];
    ['Ford', 'Toyota', ''].forEach(() => {
      levels = addChoice(levels, 0);
    });
    const removed = levels[0].options[2].value;
    levels = removeChoice(levels, 0, removed);
    levels = addChoice(levels, 0);
    expect(levels[0].options[2].value).not.toBe(removed);
    expect(levels[0].options[2].value).not.toMatch(/^choice_\d$/);
  });
});
