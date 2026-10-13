/**
 * Drag and drop rules (QA-09 owner report): containers accept drops into
 * their drop zone, fields move in and out of containers, and the keyboard
 * "Move to" menu lists the same destinations.
 */
import { resolveDrop, canDropInto, moveTargets } from './resolveDrop';
import { normalizeSchema } from '../utils/schemaTree';

const tree = () =>
  normalizeSchema({
    schema_version: 1,
    fields: [
      { id: 'a', key: 'a', type: 'text', label: 'A' },
      {
        id: 'rep',
        key: 'rep',
        type: 'repeat_container',
        label: 'Companies',
        children: [{ id: 'c1', key: 'ticker', type: 'text', label: 'Ticker' }],
      },
      { id: 'grp', key: 'grp', type: 'group_container', label: 'Group' },
      { id: 'cols', key: 'cols', type: 'two_column_container', columns: [[{ id: 'l1', key: 'l1', type: 'text' }], []] },
      { id: 'name', key: 'name', type: 'legacy_group', kind: 'group', label: 'Name' },
      { id: 'b', key: 'b', type: 'email', label: 'B' },
    ],
  });

describe('resolveDrop', () => {
  it('drops a library field into a Repeater drop zone', () => {
    const cmd = resolveDrop(tree(), { kind: 'library', fieldType: 'number' }, { kind: 'zone', parentId: 'rep', columnIndex: null });
    expect(cmd).toEqual({ type: 'insert', fieldType: 'number', parentId: 'rep', columnIndex: null, position: null });
  });

  it('drops a library field before or after a child inside a Repeater', () => {
    const over = { kind: 'node', nodeId: 'c1', parentId: 'rep', columnIndex: null, position: 0 };
    expect(resolveDrop(tree(), { kind: 'library', fieldType: 'text' }, over).position).toBe(0);
    expect(resolveDrop(tree(), { kind: 'library', fieldType: 'text' }, over, { placeAfter: true }).position).toBe(1);
  });

  it('moves a canvas field into a Repeater, a Group and a column', () => {
    const t = tree();
    expect(resolveDrop(t, { kind: 'node', nodeId: 'a' }, { kind: 'zone', parentId: 'rep', columnIndex: null }))
      .toMatchObject({ type: 'move', nodeId: 'a', parentId: 'rep' });
    expect(resolveDrop(t, { kind: 'node', nodeId: 'a' }, { kind: 'zone', parentId: 'grp', columnIndex: null }))
      .toMatchObject({ type: 'move', parentId: 'grp' });
    expect(resolveDrop(t, { kind: 'node', nodeId: 'b' }, { kind: 'zone', parentId: 'cols', columnIndex: 1 }))
      .toMatchObject({ type: 'move', parentId: 'cols', columnIndex: 1 });
  });

  it('moves a child out of a Repeater onto the form', () => {
    const cmd = resolveDrop(tree(), { kind: 'node', nodeId: 'c1' }, { kind: 'node', nodeId: 'b', parentId: 'root', columnIndex: null, position: 5 }, { placeAfter: true });
    expect(cmd).toEqual({ type: 'move', nodeId: 'c1', parentId: 'root', columnIndex: null, position: 6 });
  });

  it('keeps sorting semantics inside one list', () => {
    const cmd = resolveDrop(tree(), { kind: 'node', nodeId: 'a' }, { kind: 'node', nodeId: 'b', parentId: 'root', columnIndex: null, position: 5 }, { placeAfter: true });
    expect(cmd.position).toBe(5);
  });

  it('never drops a container into itself or a Repeater into a Repeater', () => {
    const t = tree();
    expect(resolveDrop(t, { kind: 'node', nodeId: 'rep' }, { kind: 'zone', parentId: 'rep', columnIndex: null })).toBeNull();
    expect(resolveDrop(t, { kind: 'library', fieldType: 'repeat_container' }, { kind: 'zone', parentId: 'rep', columnIndex: null })).toBeNull();
    expect(resolveDrop(t, { kind: 'library', fieldType: 'file_upload' }, { kind: 'zone', parentId: 'rep', columnIndex: null })).toBeNull();
    expect(resolveDrop(t, { kind: 'node', nodeId: 'a' }, { kind: 'node', nodeId: 'a', parentId: 'root', position: 0 })).toBeNull();
  });

  it('treats a fixed group part as the group itself', () => {
    const t = tree();
    // The name group in this schema has no saved parts; fake one.
    t.nodes.part = { id: 'part', type: 'text', parentId: 'name', config: { key: 'part' } };
    t.nodes.name.children = ['part'];
    const cmd = resolveDrop(t, { kind: 'node', nodeId: 'a' }, { kind: 'node', nodeId: 'part', parentId: 'name', columnIndex: null, position: 0 });
    expect(cmd).toMatchObject({ type: 'move', parentId: 'root', position: 4 });
  });

  it('a step tab takes library fields and canvas fields', () => {
    const t = normalizeSchema({
      schema_version: 1,
      fields: [
        { id: 's1', type: 'step', children: [{ id: 'x', key: 'x', type: 'text' }] },
        { id: 's2', type: 'step' },
      ],
    });
    expect(resolveDrop(t, { kind: 'node', nodeId: 'x' }, { kind: 'steptab', stepId: 's2' })).toEqual({ type: 'moveToStep', nodeId: 'x', stepId: 's2' });
    expect(resolveDrop(t, { kind: 'library', fieldType: 'text' }, { kind: 'steptab', stepId: 's2' })).toMatchObject({ type: 'insert', parentId: 's2' });
  });
});

describe('canDropInto', () => {
  it('keeps fields of a multi-step form inside steps', () => {
    const t = normalizeSchema({ schema_version: 1, fields: [{ id: 's1', type: 'step', children: [{ id: 'x', key: 'x', type: 'text' }] }] });
    expect(canDropInto(t, { nodeId: 'x', parentId: 'root' })).toBe(false);
    expect(canDropInto(t, { fieldType: 'text', parentId: 's1' })).toBe(true);
  });
});

describe('moveTargets (keyboard Move to menu)', () => {
  it('lists the top level and every container except where the field is', () => {
    const targets = moveTargets(tree(), 'c1', { top: 'Top level' });
    expect(targets.map((t) => t.label)).toEqual(['Top level', 'Group', 'two_column_container: column 1', 'two_column_container: column 2']);
    const fromTop = moveTargets(tree(), 'a');
    expect(fromTop.map((t) => [t.parentId, t.columnIndex])).toEqual([
      ['rep', null],
      ['grp', null],
      ['cols', 0],
      ['cols', 1],
    ]);
  });

  it('does not offer a Repeater to a Repeater', () => {
    expect(moveTargets(tree(), 'rep').map((t) => t.parentId)).toEqual(['grp', 'cols', 'cols']);
  });
});
