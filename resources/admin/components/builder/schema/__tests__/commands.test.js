import { insertNode, moveNode, deleteNode, duplicateNode } from '../index';
import { normalizeSchema } from '../../utils/schemaTree';

describe('Schema Commands', () => {
  let initialTree;

  beforeEach(() => {
    initialTree = normalizeSchema({
      schema_version: 1,
      fields: [],
    });
  });

  describe('insertNode', () => {
    it('should insert a node into the root', () => {
      const definition = { type: 'text', label: 'Text Field' };
      const newTree = insertNode(initialTree, {
        definition,
        parentId: 'root',
      });

      const rootChildren = newTree.nodes['root'].children;
      expect(rootChildren).toHaveLength(1);
      const newNodeId = rootChildren[0];
      expect(newTree.nodes[newNodeId].type).toBe('text');
    });

    it('should generate unique field keys', () => {
      const definition = { type: 'text', label: 'Text Field' };

      // Insert first node
      let tree = insertNode(initialTree, { definition, parentId: 'root' });
      const firstNodeId = tree.nodes['root'].children[0];
      const firstKey = tree.nodes[firstNodeId].config.key;

      // Insert second node with same definition
      tree = insertNode(tree, { definition, parentId: 'root' });
      const secondNodeId = tree.nodes['root'].children[1];
      const secondKey = tree.nodes[secondNodeId].config.key;

      expect(firstKey).not.toBe(secondKey);
      expect(secondKey).toContain('text_');
    });

    it('should throw if parent does not exist', () => {
      const definition = { type: 'text', label: 'Text Field' };
      expect(() => {
        insertNode(initialTree, {
          definition,
          parentId: 'non_existent_parent',
        });
      }).toThrow();
    });
  });

  describe('moveNode', () => {
    let treeWithNodes;
    let nodeId1, nodeId2;

    beforeEach(() => {
      const def1 = { type: 'text', label: 'Field 1' };
      const def2 = { type: 'email', label: 'Field 2' };

      let tree = insertNode(initialTree, { definition: def1, parentId: 'root' });
      nodeId1 = tree.nodes['root'].children[0];

      tree = insertNode(tree, { definition: def2, parentId: 'root' });
      nodeId2 = tree.nodes['root'].children[1];

      treeWithNodes = tree;
    });

    it('should move a node to a new position', () => {
      const newTree = moveNode(treeWithNodes, {
        nodeId: nodeId2,
        parentId: 'root',
        position: 0,
      });

      const rootChildren = newTree.nodes['root'].children;
      expect(rootChildren[0]).toBe(nodeId2);
      expect(rootChildren[1]).toBe(nodeId1);
    });

    it('should throw if moving to non-existent parent', () => {
      expect(() => {
        moveNode(treeWithNodes, {
          nodeId: nodeId1,
          parentId: 'missing_parent',
          position: 0,
        });
      }).toThrow();
    });
  });

  describe('deleteNode', () => {
    it('should delete a node and remove it from parent', () => {
      const definition = { type: 'text', label: 'Text Field' };
      let tree = insertNode(initialTree, { definition, parentId: 'root' });
      const nodeId = tree.nodes['root'].children[0];

      tree = deleteNode(tree, { nodeId });

      expect(tree.nodes['root'].children).toHaveLength(0);
      expect(tree.nodes[nodeId]).toBeUndefined();
    });
  });

  describe('duplicateNode', () => {
    it('should duplicate a node with a new unique key', () => {
      const definition = { type: 'text', label: 'Original' };
      let tree = insertNode(initialTree, { definition, parentId: 'root' });
      const originalId = tree.nodes['root'].children[0];
      const originalKey = tree.nodes[originalId].config.key;

      tree = duplicateNode(tree, { nodeId: originalId });

      const rootChildren = tree.nodes['root'].children;
      expect(rootChildren).toHaveLength(2);

      const newId = rootChildren[1];
      const newKey = tree.nodes[newId].config.key;

      expect(newId).not.toBe(originalId);
      expect(newKey).not.toBe(originalKey);
      expect(tree.nodes[newId].type).toBe('text');
    });
  });
});
