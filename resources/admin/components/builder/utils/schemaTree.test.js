import { normalizeSchema } from './schemaTree';

describe('schemaTree', () => {
  describe('normalizeSchema', () => {
    it('should normalize an empty schema', () => {
      const schema = { fields: [] };
      const result = normalizeSchema(schema);

      expect(result).toHaveProperty('rootId', 'root');
      expect(result.nodes).toHaveProperty('root');
      expect(result.nodes.root.children).toEqual([]);
    });

    it('should normalize a schema with a single field', () => {
      const schema = {
        fields: [
          {
            id: 'field_1',
            type: 'text',
            label: 'Name',
            config: { required: true },
          },
        ],
      };

      const result = normalizeSchema(schema);

      expect(result.nodes).toHaveProperty('field_1');
      const fieldNode = result.nodes.field_1;

      expect(fieldNode.type).toBe('text');
      expect(fieldNode.parentId).toBe('root');
      // A nested `config` is folded into the node's settings (2.2.1): a
      // wrapper left in place hid required/options from the live renderer.
      expect(fieldNode.config).toEqual(
        expect.objectContaining({
          required: true,
          label: 'Name',
          id: 'field_1',
        })
      );
      expect(fieldNode.config.config).toBeUndefined();

      expect(result.nodes.root.children).toContain('field_1');
    });

    it('should generate IDs if missing', () => {
      const schema = {
        fields: [
          {
            type: 'email',
            label: 'Email',
          },
        ],
      };

      const result = normalizeSchema(schema);
      const rootChildren = result.nodes.root.children;

      expect(rootChildren).toHaveLength(1);
      const fieldId = rootChildren[0];

      expect(fieldId).toMatch(/^node_/);
      expect(result.nodes[fieldId].type).toBe('email');
    });
  });
});

describe('FB-01: Name part settings saved as a list get their keys back', () => {
  it('turns the list into a map keyed by part', () => {
    const result = normalizeSchema({
      fields: [
        {
          id: 'nm',
          key: 'nm',
          type: 'name_group',
          fields: [
            { label: 'First Name', enabled: true },
            { label: 'Last Name', enabled: true },
            { label: 'Middle Name', enabled: true },
            { label: 'Suffix', enabled: true },
          ],
        },
      ],
    });
    const parts = result.nodes.nm.config.fields;
    expect(Array.isArray(parts)).toBe(false);
    expect(parts.middle_name.enabled).toBe(true);
    expect(parts.suffix.enabled).toBe(true);
  });
});
