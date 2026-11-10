/**
 * Tabs and Accordion commands (2.9.0).
 */
import { insertNode, duplicateNode } from '../commands';
import { addPanel, removePanel, canRemovePanel, panelIds } from '../commands/panels';
import { normalizeSchema, denormalizeTree } from '../../utils/schemaTree';

const tabsDefinition = {
  type: 'tabs_container',
  kind: 'structure',
  label: 'Tabs',
  acceptsChildren: true,
  fieldSpecificAttributes: { label: 'Tabs', position: 'top', collapse_mobile: true, active: 0 },
};
const accordionDefinition = {
  type: 'accordion_container',
  kind: 'structure',
  label: 'Accordion',
  acceptsChildren: true,
  fieldSpecificAttributes: { label: 'Accordion', multiple: false, open: 'first', icon: 'chevron' },
};

const empty = () => normalizeSchema({ schema_version: 1, fields: [] });
const insert = (tree, definition) => insertNode(tree, { definition, parentId: 'root' });

describe('a new container', () => {
  it('starts with two panels titled Tab 1 and Tab 2', () => {
    const tree = insert(empty(), tabsDefinition);
    const [id] = tree.nodes.root.children;
    const ids = panelIds(tree, id);
    expect(ids).toHaveLength(2);
    expect(ids.map((p) => tree.nodes[p].config.label)).toEqual(['Tab 1', 'Tab 2']);
    expect(ids.map((p) => tree.nodes[p].type)).toEqual(['tab_panel', 'tab_panel']);
    expect(tree.nodes[ids[0]].parentId).toBe(id);
    expect(tree.nodes[ids[0]].children).toEqual([]);
  });

  it('starts with Section 1 and Section 2 for an Accordion', () => {
    const tree = insert(empty(), accordionDefinition);
    const [id] = tree.nodes.root.children;
    expect(panelIds(tree, id).map((p) => tree.nodes[p].config.label)).toEqual(['Section 1', 'Section 2']);
    expect(panelIds(tree, id).map((p) => tree.nodes[p].type)).toEqual(['accordion_panel', 'accordion_panel']);
  });

  it('gives the container its settings and every panel a stable id and a unique key', () => {
    const tree = insert(empty(), tabsDefinition);
    const [id] = tree.nodes.root.children;
    expect(tree.nodes[id].config).toMatchObject({ position: 'top', collapse_mobile: true, active: 0 });
    const keys = Object.values(tree.nodes).filter((n) => n.id !== 'root').map((n) => n.config.key);
    expect(new Set(keys).size).toBe(keys.length);
    panelIds(tree, id).forEach((p) => expect(p).toMatch(/^node_/));
  });

  it('saves panels as children and loads them again unchanged', () => {
    const tree = insert(empty(), tabsDefinition);
    const fields = denormalizeTree(tree);
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe('tabs_container');
    expect(fields[0].children.map((c) => [c.type, c.label])).toEqual([
      ['tab_panel', 'Tab 1'],
      ['tab_panel', 'Tab 2'],
    ]);
    const again = normalizeSchema({ schema_version: 1, fields });
    expect(denormalizeTree(again)).toEqual(fields);
  });

  it('keeps an empty panel when loading', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [{ id: 't', key: 't', type: 'tabs_container', children: [{ id: 'p', key: 'p', type: 'tab_panel', label: 'Only' }] }],
    });
    expect(Array.isArray(tree.nodes.p.children)).toBe(true);
  });
});

describe('addPanel', () => {
  it('adds the next numbered panel at the end', () => {
    let tree = insert(empty(), tabsDefinition);
    const [id] = tree.nodes.root.children;
    const result = addPanel(tree, { containerId: id });
    tree = result.tree;
    expect(panelIds(tree, id)).toHaveLength(3);
    expect(tree.nodes[result.panelId].config.label).toBe('Tab 3');
    expect(panelIds(tree, id)[2]).toBe(result.panelId);
  });

  it('ignores a node that is not a Tabs or Accordion', () => {
    const tree = normalizeSchema({ schema_version: 1, fields: [{ id: 'g', key: 'g', type: 'group_container', children: [] }] });
    expect(addPanel(tree, { containerId: 'g' })).toEqual({ tree, panelId: null });
  });
});

describe('removePanel', () => {
  const build = () =>
    normalizeSchema({
      schema_version: 1,
      fields: [
        {
          id: 't',
          key: 't',
          type: 'tabs_container',
          active: 2,
          children: [
            { id: 'p1', key: 'p1', type: 'tab_panel', label: 'One', children: [{ id: 'a', key: 'a', type: 'text' }] },
            { id: 'p2', key: 'p2', type: 'tab_panel', label: 'Two', children: [{ id: 'b', key: 'b', type: 'text' }, { id: 'c', key: 'c', type: 'text' }] },
            { id: 'p3', key: 'p3', type: 'tab_panel', label: 'Three', children: [] },
          ],
        },
      ],
    });

  it('moves the fields of a deleted panel to the previous panel, in order', () => {
    const result = removePanel(build(), { panelId: 'p2' });
    expect(result.movedTo).toBe('p1');
    expect(result.count).toBe(2);
    expect(result.tree.nodes.p2).toBeUndefined();
    expect(result.tree.nodes.p1.children).toEqual(['a', 'b', 'c']);
    expect(result.tree.nodes.b.parentId).toBe('p1');
    expect(panelIds(result.tree, 't')).toEqual(['p1', 'p3']);
  });

  it('moves the fields of the first panel to the next one', () => {
    const result = removePanel(build(), { panelId: 'p1' });
    expect(result.movedTo).toBe('p2');
    expect(result.tree.nodes.p2.children).toEqual(['b', 'c', 'a']);
  });

  it('keeps the shown-first tab pointing at the same panel', () => {
    expect(removePanel(build(), { panelId: 'p1' }).tree.nodes.t.config.active).toBe(1);
    expect(removePanel(build(), { panelId: 'p3' }).tree.nodes.t.config.active).toBe(1);
  });

  it('never deletes the last panel', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [{ id: 't', key: 't', type: 'tabs_container', children: [{ id: 'p', key: 'p', type: 'tab_panel', children: [{ id: 'a', key: 'a', type: 'text' }] }] }],
    });
    expect(canRemovePanel(tree, 'p')).toBe(false);
    const result = removePanel(tree, { panelId: 'p' });
    expect(result.tree).toBe(tree);
    expect(result.movedTo).toBeNull();
    expect(result.tree.nodes.a).toBeDefined();
  });

  it('does not lose a single field', () => {
    const before = build();
    const result = removePanel(before, { panelId: 'p2' });
    const fields = (t) => Object.values(t.nodes).filter((n) => n.type === 'text').map((n) => n.id).sort();
    expect(fields(result.tree)).toEqual(fields(before));
  });
});

describe('duplicating a container', () => {
  it('copies the panels and their fields with new ids and keys', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [
        {
          id: 't',
          key: 't',
          type: 'tabs_container',
          children: [{ id: 'p1', key: 'p1', type: 'tab_panel', label: 'One', children: [{ id: 'a', key: 'a', type: 'text' }] }],
        },
      ],
    });
    const { tree: next, newNodeId } = duplicateNode(tree, { nodeId: 't', destination: { parentId: 'root', position: 1 } });
    expect(next.nodes.root.children).toHaveLength(2);
    const copyPanels = panelIds(next, newNodeId);
    expect(copyPanels).toHaveLength(1);
    expect(copyPanels[0]).not.toBe('p1');
    expect(next.nodes[next.nodes[copyPanels[0]].children[0]].type).toBe('text');
    const keys = Object.values(next.nodes).filter((n) => n.id !== 'root').map((n) => n.config.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
