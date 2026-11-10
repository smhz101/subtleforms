/**
 * Test harness for the field settings panel: mounts FieldInspector for a
 * field type with the real PHP field definitions (fixtures/fieldDefinitions.json,
 * from GET /subtleforms/v1/fields) and lists the controls it draws.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldInspector from '../../FieldInspector';
import { ConfigContext } from '../../context/ConfigContext';
import { TreeContext } from '../../context/TreeContext';
import definitions from './fixtures/fieldDefinitions.json';

global.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no ResizeObserver; WordPress tab and toggle components use one.
if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

export const FIELD_DEFINITIONS = definitions;

/** A saved field of each type the label fixture covers. */
export const FIELDS = {
  text: { id: 'n_text', key: 'text_1', type: 'text', label: 'Text' },
  dropdown: {
    id: 'n_drop',
    key: 'dropdown_1',
    type: 'dropdown',
    label: 'Dropdown',
    options: [
      { label: 'First choice', value: 'first' },
      { label: 'Second choice', value: 'second' },
    ],
  },
  multiple_choice: {
    id: 'n_multi',
    key: 'checkboxes_1',
    type: 'multiple_choice',
    label: 'Checkboxes',
    options: [
      { label: 'One', value: 'one' },
      { label: 'Two', value: 'two' },
    ],
  },
  address_group: { id: 'n_addr', key: 'address_1', type: 'address_group', label: 'Address' },
  name_group: { id: 'n_name', key: 'name_1', type: 'name_group', label: 'Name' },
  repeat_container: { id: 'n_rep', key: 'repeater_1', type: 'repeat_container', label: 'Repeater' },
  step: { id: 'n_step', key: 'step_1', type: 'step', title: 'Step 1' },
  html: { id: 'n_html', key: 'html_1', type: 'html', content: '<p>Hello</p>' },
  hidden: { id: 'n_hid', key: 'hidden_1', type: 'hidden', label: 'Hidden' },
};

/** A two-step form around the field, so the Step setting is drawn. */
function treeFor(field) {
  const isStep = field.type === 'step';
  return {
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'root', children: ['s1', ...(isStep ? [] : ['s2'])] },
      s1: { id: 's1', type: 'step', config: { title: 'Step 1', key: 'step_a' }, children: isStep ? [] : [field.id] },
      ...(isStep ? {} : { s2: { id: 's2', type: 'step', config: { title: 'Step 2', key: 'step_b' }, children: [] } }),
      ...(isStep
        ? {}
        : { [field.id]: { id: field.id, type: field.type, parentId: 's1', config: { ...field } } }),
    },
  };
}

export function makeBuilder(field, overrides = {}) {
  return {
    setSelectedId: jest.fn(),
    actions: {
      onUpdate: jest.fn(),
      onDuplicate: jest.fn(),
      onDelete: jest.fn(),
      onRenameKey: jest.fn(),
      onMoveToStep: jest.fn(),
    },
    validationErrors: [],
    selectedId: field.id,
    tree: treeFor(field),
    ...overrides,
  };
}

let builder;
export const currentBuilder = () => builder;

// nanoid ships ES modules only; a counter is enough for row ids.
jest.mock('nanoid', () => {
  let n = 0;
  return { nanoid: (size = 8) => `id${++n}`.padEnd(size, '0') };
});

// FieldInspector reads the builder through useBuilder().
jest.mock('../../context/BuilderContext', () => ({
  useBuilder: () => require('./inspectorHarness').currentBuilder(),
}));

export function mountInspector(typeOrField, { fieldOverrides = {}, builderOverrides = {}, allFields = [] } = {}) {
  const base = typeof typeOrField === 'string' ? FIELDS[typeOrField] : typeOrField;
  const field = { ...base, ...fieldOverrides };
  builder = makeBuilder(field, builderOverrides);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (nextField = field) => {
    builder = makeBuilder(nextField, builderOverrides);
    act(() =>
      root.render(
        <ConfigContext.Provider value={{ fieldDefinitions: FIELD_DEFINITIONS, entryCount: 0 }}>
          <TreeContext.Provider value={builder.tree}>
            <FieldInspector field={nextField} allFields={allFields} formAppearance={{}} />
          </TreeContext.Provider>
        </ConfigContext.Provider>
      )
    );
  };
  render();
  return {
    container,
    field,
    builder,
    render,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Open every collapsed panel or section (old PanelBody toggles and new section toggles). */
export function openEverything(container) {
  for (let i = 0; i < 20; i++) {
    const closed = container.querySelectorAll(
      '.components-panel__body-toggle[aria-expanded="false"], .sf-isec__toggle[aria-expanded="false"]'
    );
    if (!closed.length) return;
    closed.forEach((btn) => act(() => btn.click()));
  }
}

function textOf(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** The accessible name of a form control. */
export function controlName(el) {
  const doc = el.ownerDocument;
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const t = by
      .split(/\s+/)
      .map((id) => textOf(doc.getElementById(id)))
      .filter(Boolean)
      .join(' ');
    if (t) return t;
  }
  if (el.id) {
    const lab = doc.querySelector(`label[for="${el.id}"]`);
    if (lab) return textOf(lab);
  }
  const wrap = el.closest('label');
  if (wrap) return textOf(wrap);
  return '';
}

/**
 * The names of the controls drawn, as a sorted list without repeats: inputs
 * (except the radios of a group), selects, text areas and radio groups.
 * Rows of one list (Option 1 label, Option 2 label) count by pattern.
 */
export function collectControlLabels(container) {
  const names = new Set();
  container
    .querySelectorAll('input:not([type="hidden"]), select, textarea, [role="radiogroup"]')
    .forEach((el) => {
      if (el.tagName === 'INPUT' && el.type === 'radio' && el.closest('[role="radiogroup"]')) return;
      const name = controlName(el);
      names.add(name || `(unnamed ${el.tagName.toLowerCase()}${el.type ? ` ${el.type}` : ''})`);
    });
  return [...names].sort();
}
