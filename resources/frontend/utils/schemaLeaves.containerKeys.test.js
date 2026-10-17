import {
  collectContainerKeys,
  isLayoutContainerField,
} from './schemaLeaves';

describe('collectContainerKeys (Part A1: name fields cannot be typed into)', () => {
  // The regression: name_group has children (First/Last/Middle/Suffix) so the
  // old "has children => is a container" logic added its key to the
  // non-writable set. The change handler then silently dropped every keystroke
  // into First/Last Name. Composite input fields must be writable.
  const schema = [
    { type: 'name_group', key: 'name_group_abc', config: { required: true }, children: [
      { type: 'text', key: 'first_name', config: { key: 'first_name' } },
      { type: 'text', key: 'last_name', config: { key: 'last_name' } },
    ] },
    { type: 'address_group', key: 'address_group_xyz', config: {}, fields: [
      { type: 'text', key: 'street', config: { key: 'street' } },
    ] },
    { type: 'email', key: 'email_1', config: { key: 'email_1' } },
    { type: 'group_container', key: 'grp_1', config: { key: 'grp_1' }, children: [
      { type: 'text', key: 'inside_grp', config: { key: 'inside_grp' } },
    ] },
    { type: 'two_column_container', key: 'cols_1', config: { key: 'cols_1' }, columns: [
      [{ type: 'text', key: 'col_a', config: { key: 'col_a' } }],
      [{ type: 'text', key: 'col_b', config: { key: 'col_b' } }],
    ] },
    { type: 'step', key: 'step_1', config: { key: 'step_1' }, children: [
      { type: 'text', key: 'step_field', config: { key: 'step_field' } },
    ] },
  ];

  const keys = collectContainerKeys(schema);

  test('composite input fields are writable (NOT in the container set)', () => {
    expect(keys.has('name_group_abc')).toBe(false);
    expect(keys.has('address_group_xyz')).toBe(false);
  });

  test('true layout containers are in the container set', () => {
    expect(keys.has('grp_1')).toBe(true);
    expect(keys.has('cols_1')).toBe(true);
    expect(keys.has('step_1')).toBe(true);
  });

  test('leaf input fields are not in the container set', () => {
    expect(keys.has('email_1')).toBe(false);
    expect(keys.has('first_name')).toBe(false);
  });

  test('isLayoutContainerField excludes composite and input types', () => {
    expect(isLayoutContainerField({ type: 'name_group' })).toBe(false);
    expect(isLayoutContainerField({ type: 'address_group' })).toBe(false);
    expect(isLayoutContainerField({ type: 'checkbox_grid' })).toBe(false);
    expect(isLayoutContainerField({ type: 'email' })).toBe(false);
    expect(isLayoutContainerField({ type: 'group_container' })).toBe(true);
    expect(isLayoutContainerField({ type: 'step' })).toBe(true);
    expect(isLayoutContainerField({ type: 'two_column_container' })).toBe(true);
    expect(isLayoutContainerField({ type: 'section_break' })).toBe(true);
  });
});
