import { flattenFields, integrationFieldOptions, consentFieldOptions } from './integrationFields';

const fields = [
  {
    type: 'step',
    title: 'One',
    fields: [
      { type: 'name_group', key: 'who', label: 'Name', fields: { first_name: { enabled: true } } },
      { type: 'email', key: 'mail', label: 'Email' },
    ],
  },
  {
    type: 'two_column_container',
    key: 'cols',
    columns: [[{ type: 'consent', key: 'agree', label: 'I agree' }], []],
  },
  { type: 'checkbox_grid', key: 'grid', label: 'Grid', columns: ['A', 'B'] },
  { type: 'html', key: 'note', label: 'Note' },
];

describe('integrationFields', () => {
  it('flattens containers and skips layout fields', () => {
    expect(flattenFields(fields).map((f) => f.key)).toEqual(['who', 'mail', 'agree', 'grid']);
  });

  it('offers name parts for composite name fields', () => {
    const values = integrationFieldOptions(fields).map((o) => o.value);
    expect(values).toEqual(['who.first_name', 'who.last_name', 'who', 'mail', 'agree', 'grid']);
  });

  it('lists checkbox-like fields for the consent condition', () => {
    expect(consentFieldOptions(fields)).toEqual([{ label: 'I agree', value: 'agree' }]);
  });
});
