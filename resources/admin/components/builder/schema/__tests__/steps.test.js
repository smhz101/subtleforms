/**
 * QA-08: Page Break conversion, orphan repair and moving fields between steps.
 */
import {
  insertPageBreak,
  repairOrphanedFields,
  findOrphanedFields,
  moveNodeToStep,
  getStepIds,
  stepOptions,
} from '../commands/steps';
import { normalizeSchema, denormalizeTree } from '../../utils/schemaTree';
import { loadTree } from '../../state/useBuilderState';

const STEP = {
  type: 'step',
  kind: 'structure',
  acceptsChildren: true,
  fieldSpecificAttributes: { title: 'Step', description: '' },
};

function field(key, extra = {}) {
  return { id: `id_${key}`, key, type: 'text', label: key.toUpperCase(), ...extra };
}

function flatForm(n) {
  return normalizeSchema({
    schema_version: 1,
    fields: Array.from({ length: n }, (_, i) => field(`f${i + 1}`, { required: i === 0, placeholder: `p${i + 1}` })),
  });
}

function keysOfStep(tree, stepId) {
  return (tree.nodes[stepId].children || []).map((id) => tree.nodes[id].config.key);
}

describe('insertPageBreak on a form without steps', () => {
  it('puts fields above the break in step 1 and fields below in step 2 (middle)', () => {
    const tree = flatForm(5);
    const { tree: next, newStepId } = insertPageBreak(tree, { definition: STEP, parentId: 'root', position: 2 });
    const steps = getStepIds(next);
    expect(steps).toHaveLength(2);
    expect(next.nodes.root.children).toEqual(steps);
    expect(keysOfStep(next, steps[0])).toEqual(['f1', 'f2']);
    expect(keysOfStep(next, steps[1])).toEqual(['f3', 'f4', 'f5']);
    expect(newStepId).toBe(steps[1]);
    expect(findOrphanedFields(next)).toEqual([]);
  });

  it('at the end keeps every field in step 1 and starts an empty step 2', () => {
    const tree = flatForm(3);
    const { tree: next } = insertPageBreak(tree, { definition: STEP, parentId: 'root', position: null });
    const steps = getStepIds(next);
    expect(keysOfStep(next, steps[0])).toEqual(['f1', 'f2', 'f3']);
    expect(keysOfStep(next, steps[1])).toEqual([]);
  });

  it('at the very top keeps every field in step 1 (nothing is orphaned or hidden)', () => {
    const tree = flatForm(35);
    const { tree: next } = insertPageBreak(tree, { definition: STEP, parentId: 'root', position: 0 });
    const steps = getStepIds(next);
    expect(steps).toHaveLength(2);
    expect(keysOfStep(next, steps[0])).toHaveLength(35);
    expect(keysOfStep(next, steps[1])).toEqual([]);
  });

  it('keeps ids, keys and settings and denormalizes to a steps-only root', () => {
    const tree = flatForm(4);
    const { tree: next } = insertPageBreak(tree, { definition: STEP, parentId: 'root', position: 1 });
    const fields = denormalizeTree(next);
    expect(fields.map((f) => f.type)).toEqual(['step', 'step']);
    expect(fields[0].children.map((f) => f.key)).toEqual(['f1']);
    expect(fields[0].children[0]).toMatchObject({ id: 'id_f1', required: true, placeholder: 'p1' });
    expect(fields[1].children.map((f) => f.id)).toEqual(['id_f2', 'id_f3', 'id_f4']);
    expect(fields[0].title).toBe('Step 1');
    expect(fields[1].title).toBe('Step 2');
  });

  it('does not mutate the input tree (so Undo restores the original)', () => {
    const tree = flatForm(3);
    const snapshot = JSON.stringify(tree);
    insertPageBreak(tree, { definition: STEP, parentId: 'root', position: 1 });
    expect(JSON.stringify(tree)).toBe(snapshot);
  });

  it('round-trips through save and reload', () => {
    const tree = flatForm(4);
    const { tree: next } = insertPageBreak(tree, { definition: STEP, parentId: 'root', position: 2 });
    const reloaded = loadTree({ schema_version: 1, fields: denormalizeTree(next) });
    expect(reloaded.repairs).toBeUndefined();
    const steps = getStepIds(reloaded);
    expect(keysOfStep(reloaded, steps[0])).toEqual(['f1', 'f2']);
    expect(keysOfStep(reloaded, steps[1])).toEqual(['f3', 'f4']);
  });

  it('a break dropped inside a container breaks after the container', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [
        field('a'),
        { id: 'rep', key: 'rep', type: 'repeat_container', label: 'R', children: [field('c1')] },
        field('b'),
      ],
    });
    const { tree: next } = insertPageBreak(tree, { definition: STEP, parentId: 'rep', position: 0 });
    const steps = getStepIds(next);
    expect(keysOfStep(next, steps[0])).toEqual(['a', 'rep']);
    expect(keysOfStep(next, steps[1])).toEqual(['b']);
    expect(next.nodes.rep.children).toEqual(['id_c1']);
  });
});

describe('insertPageBreak on a multi-step form', () => {
  const multi = () =>
    normalizeSchema({
      schema_version: 1,
      fields: [
        { id: 's1', key: 's1', type: 'step', title: 'Contact', children: [field('a'), field('b'), field('c')] },
        { id: 's2', key: 's2', type: 'step', title: 'Payment', children: [field('d')] },
      ],
    });

  it('splits the step at the insertion point', () => {
    const { tree: next, newStepId } = insertPageBreak(multi(), { definition: STEP, parentId: 's1', position: 1 });
    expect(next.nodes.root.children).toEqual(['s1', newStepId, 's2']);
    expect(keysOfStep(next, 's1')).toEqual(['a']);
    expect(keysOfStep(next, newStepId)).toEqual(['b', 'c']);
    expect(next.nodes.id_b.parentId).toBe(newStepId);
  });

  it('adds an empty step after the current step when added at its end', () => {
    const { tree: next, newStepId } = insertPageBreak(multi(), { definition: STEP, parentId: 's1', position: null });
    expect(next.nodes.root.children).toEqual(['s1', newStepId, 's2']);
    expect(keysOfStep(next, newStepId)).toEqual([]);
  });

  it('appends a step from the root (the + Add step button)', () => {
    const { tree: next, newStepId } = insertPageBreak(multi(), { definition: STEP, parentId: 'root', position: null });
    expect(next.nodes.root.children).toEqual(['s1', 's2', newStepId]);
  });
});

describe('repairOrphanedFields (form 9 shape)', () => {
  const form9 = () =>
    normalizeSchema({
      schema_version: 1,
      fields: [
        field('f1', { logic: { action: 'show', rules: [{ field: 'f2', operator: 'is', value: 'x' }] } }),
        field('f2'),
        { id: 'st', key: 'st', type: 'step', title: 'Step 1' },
        field('f3'),
      ],
    });

  it('moves root fields into the first step keeping order, keys, settings and logic', () => {
    const tree = form9();
    expect(findOrphanedFields(tree)).toEqual(['id_f1', 'id_f2', 'id_f3']);
    const { tree: fixed, moved } = repairOrphanedFields(tree);
    expect(moved).toHaveLength(3);
    expect(fixed.nodes.root.children).toEqual(['st']);
    expect(keysOfStep(fixed, 'st')).toEqual(['f1', 'f2', 'f3']);
    expect(fixed.nodes.id_f1.config.logic.rules[0].field).toBe('f2');
    expect(fixed.nodes.id_f3.parentId).toBe('st');
  });

  it('runs on load and reports the repair', () => {
    const fields = denormalizeTree(form9());
    const tree = loadTree({ schema_version: 1, fields });
    expect(tree.repairs).toEqual({ orphansMoved: 3 });
    expect(findOrphanedFields(tree)).toEqual([]);
    expect(denormalizeTree(tree).map((f) => f.type)).toEqual(['step']);
  });

  it('leaves a single-page form alone', () => {
    const tree = flatForm(2);
    expect(repairOrphanedFields(tree).moved).toEqual([]);
  });
});

describe('moveNodeToStep', () => {
  const multi = () =>
    normalizeSchema({
      schema_version: 1,
      fields: [
        { id: 's1', key: 's1', type: 'step', title: 'Contact', children: [field('a', { required: true }), field('b')] },
        { id: 's2', key: 's2', type: 'step', title: 'Payment', children: [field('d')] },
      ],
    });

  it('moves a field to the end of the target step keeping its key and settings', () => {
    const next = moveNodeToStep(multi(), { nodeId: 'id_a', stepId: 's2' });
    expect(keysOfStep(next, 's1')).toEqual(['b']);
    expect(keysOfStep(next, 's2')).toEqual(['d', 'a']);
    expect(next.nodes.id_a).toMatchObject({ parentId: 's2', config: { key: 'a', required: true } });
  });

  it('ignores moves to the same step or to a non-step', () => {
    const tree = multi();
    expect(moveNodeToStep(tree, { nodeId: 'id_a', stepId: 's1' })).toBe(tree);
    expect(moveNodeToStep(tree, { nodeId: 'id_a', stepId: 'id_b' })).toBe(tree);
  });

  it('labels steps by their titles', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [
        { id: 's1', type: 'step', title: 'Step 1' },
        { id: 's2', type: 'step', title: 'Payment' },
      ],
    });
    expect(stepOptions(tree)).toEqual([
      { value: 's1', label: 'Step 1' },
      { value: 's2', label: 'Step 2: Payment' },
    ]);
  });
});
