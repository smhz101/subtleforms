/**
 * 2.3.2 builder logic:
 * - item 1: removing the last Page Break puts every field back on one page;
 * - item 3: the conversational question list (builder and live form agree);
 * - item 5: per-field display settings with form defaults, admin label,
 *   and the load-time migration of the old "Hide label" and pattern message.
 */
import { insertPageBreak, removeStep, unwrapSingleStep, getStepIds } from '../commands/steps';
import { normalizeSchema, denormalizeTree, nodeToField } from '../../utils/schemaTree';
import { questionFields, questionIds } from '../../../../../shared/conversational';
import { fieldDisplay, formFieldDefaults, adminLabel } from '../../../../../shared/fieldDisplay';
import { validateField, validateFields } from '../../../../../frontend/utils/fieldValidation';

const STEP = {
  type: 'step',
  kind: 'structure',
  acceptsChildren: true,
  fieldSpecificAttributes: { title: 'Step', description: '' },
};

const field = (key, extra = {}) => ({ id: `id_${key}`, key, type: 'text', label: key.toUpperCase(), ...extra });

function flatForm(n) {
  return normalizeSchema({ schema_version: 1, fields: Array.from({ length: n }, (_, i) => field(`f${i + 1}`)) });
}

describe('item 1: removing the last Page Break', () => {
  it('deleting one of two steps puts every remaining field back on one page, in order', () => {
    const split = insertPageBreak(flatForm(4), { definition: STEP, parentId: 'root', position: 2 }).tree;
    expect(getStepIds(split)).toHaveLength(2);
    const [, second] = getStepIds(split);
    // Remove the empty-ish second step's boundary: its fields go with it (as in 2.3.1),
    // and the first step is unwrapped.
    const { tree, unwrapped } = removeStep(split, second);
    expect(unwrapped).toBe(true);
    expect(getStepIds(tree)).toHaveLength(0);
    expect(denormalizeTree(tree).map((f) => f.key)).toEqual(['f1', 'f2']);
  });

  it('removing the only step keeps all its fields', () => {
    const one = normalizeSchema({
      schema_version: 1,
      fields: [{ id: 's', key: 's', type: 'step', title: 'One', children: [field('a'), field('b')] }, ],
    });
    const { tree, unwrapped } = removeStep(one, 's');
    expect(unwrapped).toBe(true);
    expect(denormalizeTree(tree).map((f) => f.key)).toEqual(['a', 'b']);
    expect(tree.nodes.id_a.parentId).toBe('root');
  });

  it('with three steps, deleting one keeps the form multi-step', () => {
    let tree = insertPageBreak(flatForm(3), { definition: STEP, parentId: 'root', position: 1 }).tree;
    const [, s2] = getStepIds(tree);
    tree = insertPageBreak(tree, { definition: STEP, parentId: s2, position: 1 }).tree;
    expect(getStepIds(tree)).toHaveLength(3);
    const { tree: after, unwrapped } = removeStep(tree, getStepIds(tree)[2]);
    expect(unwrapped).toBe(false);
    expect(getStepIds(after)).toHaveLength(2);
  });

  it('unwrapSingleStep leaves a form with two steps alone', () => {
    const split = insertPageBreak(flatForm(2), { definition: STEP, parentId: 'root', position: 1 }).tree;
    expect(unwrapSingleStep(split).unwrapped).toBe(false);
  });
});

describe('item 3: conversational questions', () => {
  const fields = [
    { key: 'welcome', type: 'html', content: '<p>Hi</p>' },
    { key: 'name', type: 'text' },
    { key: 'grp', type: 'group_container', children: [{ key: 'city', type: 'text' }] },
    { key: 's1', type: 'step', children: [{ key: 'old', type: 'email' }] },
  ];

  it('every root field is a question; a Group is one question; old step fields are kept', () => {
    expect(questionFields(fields).map((f) => f.key)).toEqual(['welcome', 'name', 'grp', 'old']);
  });

  it('the builder tree gives the same questions', () => {
    const tree = normalizeSchema({ schema_version: 1, fields });
    const keys = questionIds(tree, 'root').map((id) => nodeToField(tree, id).key);
    expect(keys).toEqual(['welcome', 'name', 'grp', 'old']);
  });
});

describe('item 5: field display settings', () => {
  it('field settings win over form defaults; the old Hide label counts as hidden', () => {
    const defaults = formFieldDefaults({ labelVisibility: 'hidden', descriptionPlacement: 'above' });
    expect(fieldDisplay({ key: 'a' }, defaults)).toEqual({ labelHidden: true, descriptionAbove: true });
    expect(fieldDisplay({ key: 'a', labelVisibility: 'visible', descriptionPlacement: 'below' }, defaults)).toEqual({
      labelHidden: false,
      descriptionAbove: false,
    });
    expect(fieldDisplay({ key: 'a', appearance: { hideLabel: true } }, formFieldDefaults({}))).toEqual({
      labelHidden: true,
      descriptionAbove: false,
    });
    expect(fieldDisplay({ key: 'a', config: { labelVisibility: 'hidden' } })).toMatchObject({ labelHidden: true });
  });

  it('admin label, then label, then key', () => {
    expect(adminLabel({ key: 'e', label: 'Email', adminLabel: 'Contact email' })).toBe('Contact email');
    expect(adminLabel({ key: 'e', label: 'Email', adminLabel: '  ' })).toBe('Email');
    expect(adminLabel({ key: 'e' })).toBe('e');
    expect(adminLabel({ key: 'e', config: { adminLabel: 'Wrapped' } })).toBe('Wrapped');
  });

  it('loading a field moves the old Hide label and pattern message to the new settings', () => {
    const tree = normalizeSchema({
      schema_version: 1,
      fields: [field('a', { appearance: { hideLabel: true, width: '50' }, patternMessage: 'Two letters' })],
    });
    const out = denormalizeTree(tree)[0];
    expect(out.labelVisibility).toBe('hidden');
    expect(out.appearance).toEqual({ width: '50' });
    expect(out.validationMessage).toBe('Two letters');
    expect(out.patternMessage).toBeUndefined();
  });

  it('the custom validation message replaces format messages, not the required one', () => {
    const email = { key: 'e', type: 'email', required: true, requiredMessage: 'Need it', validationMessage: 'Bad email' };
    expect(validateField(email, '')).toBe('Need it');
    expect(validateField(email, 'nope')).toBe('Bad email');
    expect(validateField({ key: 'n', type: 'number', max: 5, validationMessage: 'Too big' }, '9')).toBe('Too big');
    expect(validateField({ key: 'n', type: 'number', max: 5 }, '9')).toMatch(/no more than 5/);
  });

  it('form defaults for messages apply when a field has none', () => {
    const defaults = formFieldDefaults({ requiredMessage: 'Please answer', validationMessage: 'Please check' });
    const errors = validateFields(
      [
        { key: 'a', type: 'text', required: true },
        { key: 'b', type: 'email' },
        { key: 'c', type: 'email', validationMessage: 'Own' },
      ],
      { b: 'x', c: 'y' },
      new Set(),
      defaults
    );
    expect(errors).toEqual({ a: 'Please answer', b: 'Please check', c: 'Own' });
  });
});
