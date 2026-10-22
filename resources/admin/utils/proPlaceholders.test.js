import { withProPlaceholders } from './proPlaceholders';

describe('Pro placeholders in the field library', () => {
  const groups = { basic: [{ type: 'text', label: 'Text' }], choices: [{ type: 'radio', label: 'Radio' }] };

  test('lists Picture Choice as a locked Pro tile that opens the upgrade modal', () => {
    const out = withProPlaceholders(groups);
    const tile = out.choices.find((f) => f.type === 'picture_choice');
    expect(tile).toMatchObject({
      label: 'Picture Choice',
      is_pro: true,
      is_pro_locked: true,
      upgrade_key: 'fields.picture_choice',
    });
  });

  test('has nothing behind it: no definition, settings or default', () => {
    const tile = withProPlaceholders(groups).choices.find((f) => f.type === 'picture_choice');
    expect(Object.keys(tile).sort()).toEqual(
      ['category', 'enabled', 'icon', 'is_pro', 'is_pro_locked', 'kind', 'label', 'meta', 'type', 'upgrade_key']
    );
  });

  test('does not touch the groups it was given', () => {
    const copy = JSON.stringify(groups);
    withProPlaceholders(groups);
    expect(JSON.stringify(groups)).toBe(copy);
  });

  test('is not shown when the real field is registered', () => {
    const real = { ...groups, choices: [...groups.choices, { type: 'picture_choice', label: 'Picture Choice', is_pro_locked: false }] };
    const out = withProPlaceholders(real);
    expect(out.choices.filter((f) => f.type === 'picture_choice')).toHaveLength(1);
    expect(out.choices.find((f) => f.type === 'picture_choice').is_pro_locked).toBe(false);
  });

  test('creates the choices group when the library has none', () => {
    expect(Object.keys(withProPlaceholders({ basic: [] }))).toEqual(['basic', 'choices']);
  });
});
