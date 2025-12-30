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
    expect(schema.fields[0]?.type).toBe('one_column_container');
    expect(schema.fields[0]?.key).toBeTruthy();
    expect(Array.isArray(schema.fields[0]?.fields)).toBe(true);
    expect(schema.fields[0]?.fields?.[0]?.type).toBe('text');
    expect(schema.fields[0]?.fields?.[0]?.key).toBeTruthy();
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
    expect(schema.fields[0]?.fields?.length).toBeGreaterThan(0);
    expect(schema.fields[0]?.fields?.[0]?.type).toBeTruthy();
    expect(schema.fields[0]?.fields?.[0]?.key).toBeTruthy();
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
    expect(schema.fields[0]?.type).toBe('html');
    expect(schema.fields[0]?.key).toBeTruthy();
    expect(schema.fields.some((f) => f.type === 'text')).toBe(true);
  });
});
