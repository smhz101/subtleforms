/**
 * Tabs and Accordion nesting rules (2.9.0).
 */
import { resolveDrop, canDropInto, moveTargets } from './resolveDrop';
import { normalizeSchema } from '../utils/schemaTree';

const panel = (id, type, children = []) => ({ id, key: id, type, label: id, children });
const tabs = (id, panels) => ({ id, key: id, type: 'tabs_container', label: 'Tabs', children: panels });
const acc = (id, panels) => ({ id, key: id, type: 'accordion_container', label: 'Acc', children: panels });
const text = (id) => ({ id, key: id, type: 'text', label: id });

const build = (fields) => normalizeSchema({ schema_version: 1, fields });

const zone = (parentId) => ({ kind: 'zone', parentId, columnIndex: null });
const library = (fieldType) => ({ kind: 'library', fieldType });
const node = (nodeId) => ({ kind: 'node', nodeId });

describe('Tabs and Accordion placement', () => {
  const base = () =>
    build([
      text('a'),
      { id: 'grp', key: 'grp', type: 'group_container', label: 'G', children: [] },
      { id: 'cols', key: 'cols', type: 'two_column_container', columns: [[], []] },
      { id: 'rep', key: 'rep', type: 'repeat_container', label: 'R', children: [] },
      tabs('t1', [panel('t1p1', 'tab_panel', [text('x')]), panel('t1p2', 'tab_panel')]),
    ]);

  it('allows Tabs and Accordion at the root, in a group and in a column', () => {
    const t = base();
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'root' })).toBe(true);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'root' })).toBe(true);
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'grp' })).toBe(true);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'cols' })).toBe(true);
  });

  it('allows Tabs and Accordion inside a step', () => {
    const t = build([{ id: 's1', type: 'step', children: [text('a')] }]);
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 's1' })).toBe(true);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 's1' })).toBe(true);
  });

  it('refuses Tabs and Accordion inside a Repeater, at any depth', () => {
    const t = base();
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'rep' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'rep' })).toBe(false);
    const nested = build([
      { id: 'rep', key: 'rep', type: 'repeat_container', label: 'R', children: [{ id: 'g', key: 'g', type: 'group_container', children: [] }] },
    ]);
    expect(canDropInto(nested, { fieldType: 'tabs_container', parentId: 'g' })).toBe(false);
    expect(canDropInto(nested, { fieldType: 'accordion_container', parentId: 'g' })).toBe(false);
  });

  it('refuses moving an existing Tabs into a Repeater', () => {
    expect(canDropInto(base(), { nodeId: 't1', parentId: 'rep' })).toBe(false);
  });

  it('never accepts a step inside Tabs, an Accordion or a panel', () => {
    const t = base();
    expect(canDropInto(t, { fieldType: 'step', parentId: 't1' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'step', parentId: 't1p1' })).toBe(false);
    expect(resolveDrop(t, library('step'), zone('t1p1'))).toBeNull();
    expect(resolveDrop(t, library('step'), zone('t1'))).toBeNull();
    const nested = build([
      tabs('t', [panel('tp', 'tab_panel', [{ id: 'g', key: 'g', type: 'group_container', children: [] }])]),
    ]);
    expect(resolveDrop(nested, library('step'), zone('g'))).toBeNull();
  });

  it('refuses a step node moved into a panel container', () => {
    const t = build([{ id: 's1', type: 'step', children: [tabs('t', [panel('tp', 'tab_panel')])] }]);
    expect(canDropInto(t, { nodeId: 's1', parentId: 'tp' })).toBe(false);
  });
});

describe('Tabs inside Tabs and Accordion inside Accordion', () => {
  it('refuses Tabs inside Tabs and Accordion inside an Accordion', () => {
    const t = build([
      tabs('t', [panel('tp', 'tab_panel')]),
      acc('ac', [panel('ap', 'accordion_panel')]),
    ]);
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'tp' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'ap' })).toBe(false);
  });

  it('refuses the same container type at any depth', () => {
    const t = build([
      tabs('t', [panel('tp', 'tab_panel', [{ id: 'g', key: 'g', type: 'group_container', children: [] }])]),
      acc('ac', [panel('ap', 'accordion_panel', [{ id: 'g2', key: 'g2', type: 'group_container', children: [] }])]),
    ]);
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'g' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'g2' })).toBe(false);
  });

  it('allows Tabs inside an Accordion and an Accordion inside Tabs, one level', () => {
    const t = build([
      tabs('t', [panel('tp', 'tab_panel')]),
      acc('ac', [panel('ap', 'accordion_panel')]),
    ]);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'tp' })).toBe(true);
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'ap' })).toBe(true);
  });

  it('refuses a third level: Tabs in an Accordion in Tabs, and the reverse', () => {
    const t = build([
      tabs('t', [panel('tp', 'tab_panel', [acc('ac', [panel('ap', 'accordion_panel')])])]),
      acc('ac2', [panel('ap2', 'accordion_panel', [tabs('t2', [panel('tp2', 'tab_panel')])])]),
    ]);
    expect(canDropInto(t, { fieldType: 'tabs_container', parentId: 'ap' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'accordion_container', parentId: 'tp2' })).toBe(false);
  });

  it('refuses moving a container that holds the same type into a panel of that type', () => {
    const t = build([
      acc('ac', [panel('ap', 'accordion_panel', [tabs('inner', [panel('ip', 'tab_panel')])])]),
      tabs('t', [panel('tp', 'tab_panel')]),
    ]);
    // Moving the Accordion (which holds Tabs) into the Tabs panel would put Tabs inside Tabs.
    expect(canDropInto(t, { nodeId: 'ac', parentId: 'tp' })).toBe(false);
  });
});

describe('Panels', () => {
  const two = () =>
    build([
      tabs('t', [panel('p1', 'tab_panel', [text('x')]), panel('p2', 'tab_panel')]),
      tabs('t2', [panel('q1', 'tab_panel'), panel('q2', 'tab_panel')]),
      acc('ac', [panel('a1', 'accordion_panel')]),
      { id: 'grp', key: 'grp', type: 'group_container', label: 'G', children: [] },
      text('a'),
    ]);

  it('accepts a panel only as a direct child of its own container type', () => {
    const t = two();
    expect(canDropInto(t, { nodeId: 'p1', parentId: 't' })).toBe(true);
    expect(canDropInto(t, { nodeId: 'p1', parentId: 'root' })).toBe(false);
    expect(canDropInto(t, { nodeId: 'p1', parentId: 'grp' })).toBe(false);
    expect(canDropInto(t, { nodeId: 'p1', parentId: 'ac' })).toBe(false);
    expect(canDropInto(t, { nodeId: 'p1', parentId: 'p2' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'tab_panel', parentId: 'root' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'accordion_panel', parentId: 't' })).toBe(false);
  });

  it('allows reordering inside one container', () => {
    const cmd = resolveDrop(two(), node('p1'), { kind: 'node', nodeId: 'p2', parentId: 't', columnIndex: null, position: 1 });
    expect(cmd).toMatchObject({ type: 'move', nodeId: 'p1', parentId: 't' });
  });

  it('allows moving a panel to another container of the same type', () => {
    expect(canDropInto(two(), { nodeId: 'p2', parentId: 't2' })).toBe(true);
  });

  it('refuses moving the last panel of a container away', () => {
    expect(canDropInto(two(), { nodeId: 'a1', parentId: 't' })).toBe(false);
    const t = build([
      tabs('t', [panel('p1', 'tab_panel')]),
      tabs('t2', [panel('q1', 'tab_panel')]),
    ]);
    expect(canDropInto(t, { nodeId: 'p1', parentId: 't2' })).toBe(false);
  });

  it('accepts fields but nothing else a container may not hold inside a panel', () => {
    const t = two();
    expect(canDropInto(t, { fieldType: 'text', parentId: 'p1' })).toBe(true);
    expect(canDropInto(t, { nodeId: 'a', parentId: 'p2' })).toBe(true);
  });

  it('refuses a field dropped on the container itself, outside its panels', () => {
    const t = two();
    expect(canDropInto(t, { fieldType: 'text', parentId: 't' })).toBe(false);
    expect(canDropInto(t, { nodeId: 'a', parentId: 't' })).toBe(false);
    expect(resolveDrop(t, library('text'), zone('t'))).toBeNull();
    expect(resolveDrop(t, library('text'), zone('p1'))).toMatchObject({ type: 'insert', parentId: 'p1' });
  });

  it('keeps the keyboard Move to menu to valid destinations', () => {
    const targets = moveTargets(two(), 'a', {}).map((x) => x.parentId);
    expect(targets).toEqual(expect.arrayContaining(['p1', 'p2', 'q1', 'q2', 'a1', 'grp']));
    expect(targets).not.toContain('t');
    expect(targets).not.toContain('ac');
    expect(moveTargets(two(), 'p1', {}).map((x) => x.parentId)).toEqual(['t2']);
  });
});
