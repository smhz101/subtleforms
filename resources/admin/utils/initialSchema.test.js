import { createInitialSchema } from './initialSchema';

describe('createInitialSchema', () => {
  it('creates a regular blank schema', () => {
    const schema = createInitialSchema({
      title: 'Test',
      description: '',
      formType: 'regular',
      startingPoint: 'blank',
    });

    expect(schema.schema_version).toBe(1);
    expect(schema.metadata.type).toBe('regular');
    expect(Array.isArray(schema.fields)).toBe(true);
    // Regular blank starts with an empty canvas; fields are added by the user
    expect(schema.fields).toHaveLength(0);
  });

  it('creates a multi-step schema with at least one step', () => {
    const schema = createInitialSchema({
      title: 'Test',
      description: '',
      formType: 'multi-step',
      startingPoint: 'blank',
    });

    expect(schema.metadata.type).toBe('multi-step');
    expect(schema.fields[0]?.type).toBe('step');
    expect(schema.fields[0]?.key).toBeTruthy();
    expect(Array.isArray(schema.fields[0]?.fields)).toBe(true);
    // Step starts empty; the user adds fields to it
    expect(schema.fields[0].fields).toHaveLength(0);
  });

  it('creates a conversational minimal schema with questions', () => {
    const schema = createInitialSchema({
      title: 'Test',
      description: '',
      formType: 'conversational',
      startingPoint: 'minimal',
    });

    expect(schema.metadata.type).toBe('conversational');
    expect(schema.fields.length).toBeGreaterThan(0);
    // Minimal conversational starts with the intro HTML block only
    expect(schema.fields[0]?.type).toBe('html');
    expect(schema.fields[0]?.key).toBeTruthy();
  });
});
