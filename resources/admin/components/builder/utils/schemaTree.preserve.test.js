import { normalizeSchema, denormalizeTree } from './schemaTree';

describe('normalizeSchema preserves fields (Part A4: no field lost on load)', () => {
  // A published form's fields must all survive a load → normalize → denormalize
  // round trip. The consent field in particular was reported disappearing
  // after a 1.9.x normaliser; this guards against that regression.
  const schema = {
    schema_version: 1,
    metadata: { name: 'Newsletter sign up', title: 'Newsletter sign up' },
    fields: [
      { id: 'node_name', key: 'name_group_1', type: 'name_group', kind: 'group', config: { required: true } },
      { id: 'node_email', key: 'email_1', type: 'email', kind: 'input', config: { required: true } },
      { id: 'node_consent', key: 'consent_1', type: 'consent', kind: 'input', config: { required: true, checkboxLabel: 'I agree' } },
      { id: 'node_phone', key: 'phone_1', type: 'phone', kind: 'input', config: {} },
    ],
  };

  test('every root-level field survives normalize + denormalize', () => {
    const tree = normalizeSchema(schema);
    const roundTripped = denormalizeTree(tree);
    const keys = roundTripped.map((f) => f.key).sort();
    expect(keys).toEqual(['consent_1', 'email_1', 'name_group_1', 'phone_1']);
  });

  test('the consent field is never dropped', () => {
    const tree = normalizeSchema(schema);
    const roundTripped = denormalizeTree(tree);
    const consent = roundTripped.find((f) => f.type === 'consent');
    expect(consent).toBeDefined();
    expect(consent.key).toBe('consent_1');
  });

  test('field count is preserved', () => {
    const tree = normalizeSchema(schema);
    const roundTripped = denormalizeTree(tree);
    expect(roundTripped.length).toBe(schema.fields.length);
  });
});
