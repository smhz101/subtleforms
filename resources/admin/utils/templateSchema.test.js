import { schemaFromTemplate } from './templateSchema';

const volunteer = {
  id: 'volunteer_signup',
  name: 'Volunteer Signup',
  is_pro: true,
  schema: {
    metadata: { title: 'Volunteer Application', description: 'Join our volunteer team', appearance: { preset: 'dark' } },
    fields: [
      { id: 'full_name', type: 'text', label: 'Full Name', required: true },
      { id: 'availability', type: 'multiple_choice', allowMultiple: true, options: [{ value: 'am', label: 'AM' }] },
    ],
    actions: [{ id: 'save', type: 'save', enabled: true }, { id: 'webhook', type: 'webhook', enabled: true }],
  },
};

describe('schemaFromTemplate (2.3.2 item 2)', () => {
  it('keeps every field, the settings and the actions', () => {
    const schema = schemaFromTemplate(volunteer, { title: 'My volunteers' });
    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[1].options).toHaveLength(1);
    expect(schema.actions.map((a) => a.type)).toEqual(['save', 'webhook']);
    expect(schema.metadata).toMatchObject({
      title: 'My volunteers',
      name: 'form_schema',
      template: 'volunteer_signup',
      description: 'Join our volunteer team',
      appearance: { preset: 'dark' },
      type: 'regular',
    });
    expect(schema.schema_version).toBe(1);
  });

  it('does not share objects with the template list', () => {
    const schema = schemaFromTemplate(volunteer, { title: 'x' });
    schema.fields[0].label = 'Changed';
    expect(volunteer.schema.fields[0].label).toBe('Full Name');
  });

  it('a typed description wins over the template one', () => {
    expect(schemaFromTemplate(volunteer, { title: 'x', description: 'Mine' }).metadata.description).toBe('Mine');
  });

  it('takes the type from the structure', () => {
    const steps = {
      id: 'grant',
      schema: { metadata: {}, fields: [{ type: 'step', key: 's1', children: [{ type: 'text', key: 'a' }] }] },
    };
    expect(schemaFromTemplate(steps, { title: 'g' }).metadata.type).toBe('multi-step');
    const quiz = { id: 'quiz', schema: { metadata: { type: 'conversational' }, fields: [{ type: 'radio', key: 'q' }] } };
    expect(schemaFromTemplate(quiz, { title: 'q' }).metadata.type).toBe('conversational');
  });
});
