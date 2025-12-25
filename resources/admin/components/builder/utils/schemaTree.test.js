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
      expect(fieldNode.config).toEqual(
        expect.objectContaining({
          config: { required: true },
          label: 'Name',
          id: 'field_1',
        })
      );

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
