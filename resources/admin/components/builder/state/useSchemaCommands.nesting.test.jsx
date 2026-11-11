/**
 * The inline Add field picker obeys the drag and drop nesting rules (2.9.0):
 * handleInsert refuses what the schema validator would reject, and the picker
 * list leaves those types out.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { useSchemaCommands } from './useSchemaCommands';
import FieldPickerPopover from '../FieldPickerPopover';
import { normalizeSchema } from '../utils/schemaTree';

jest.mock('../FieldToolbar.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const panel = (id, type, children = []) => ({ id, key: id, type, label: id, children });
const tabs = (id, panels) => ({ id, key: id, type: 'tabs_container', label: 'Tabs', children: panels });
const acc = (id, panels) => ({ id, key: id, type: 'accordion_container', label: 'Acc', children: panels });
const text = (id) => ({ id, key: id, type: 'text', label: id });

const tree = normalizeSchema({
  schema_version: 1,
  fields: [
    tabs('t1', [panel('t1p1', 'tab_panel', [text('x')]), panel('t1p2', 'tab_panel')]),
    acc('a1', [panel('a1p1', 'accordion_panel'), panel('a1p2', 'accordion_panel')]),
  ],
});

const definitionMap = Object.fromEntries(
  ['text', 'step', 'tabs_container', 'accordion_container', 'tab_panel'].map((type) => [
    type,
    { type, label: type },
  ])
);

function mountCommands(updateTree) {
  let commands;
  function Probe() {
    commands = useSchemaCommands({
      tree,
      updateTree,
      setTree: jest.fn(),
      setSelectedId: jest.fn(),
      selectedStepId: null,
      setSelectedStepId: jest.fn(),
      rootId: 'root',
      definitionMap,
      isReadOnly: false,
      onChange: jest.fn(),
      schemaRef: { current: null },
    });
    return null;
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Probe />));
  return { get: () => commands, unmount: () => act(() => root.unmount()) };
}

describe('handleInsert nesting (inline picker)', () => {
  it('refuses Tabs inside a Tabs panel', () => {
    const updateTree = jest.fn();
    const m = mountCommands(updateTree);
    m.get().handleInsert('tabs_container', { parentId: 't1p1', columnIndex: null, position: null });
    expect(updateTree).not.toHaveBeenCalled();
    m.unmount();
  });

  it('refuses a step inside a panel', () => {
    const updateTree = jest.fn();
    const m = mountCommands(updateTree);
    m.get().handleInsert('step', { parentId: 't1p1', columnIndex: null, position: null });
    m.get().handleInsert('step', { parentId: 'a1p1', columnIndex: null, position: null });
    expect(updateTree).not.toHaveBeenCalled();
    m.unmount();
  });

  it('refuses a panel outside its container', () => {
    const updateTree = jest.fn();
    const m = mountCommands(updateTree);
    m.get().handleInsert('tab_panel', { parentId: 'root', columnIndex: null, position: null });
    expect(updateTree).not.toHaveBeenCalled();
    m.unmount();
  });

  it('still inserts an ordinary field into a panel', () => {
    const updateTree = jest.fn();
    const m = mountCommands(updateTree);
    m.get().handleInsert('text', { parentId: 't1p1', columnIndex: null, position: null });
    expect(updateTree).toHaveBeenCalledTimes(1);
    m.unmount();
  });
});

describe('the Add field picker list', () => {
  const groups = {
    layout: [
      { type: 'step', label: 'Page Break' },
      { type: 'tabs_container', label: 'Tabs' },
      { type: 'accordion_container', label: 'Accordion' },
    ],
    basic: [{ type: 'text', label: 'Text' }],
  };

  function labelsAt(parentId) {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() =>
      root.render(
        <FieldPickerPopover
          fieldGroups={groups}
          context={{ parentId, columnIndex: null, position: null }}
          onInsert={jest.fn()}
          tree={tree}
          rootId='root'
        />
      )
    );
    const labels = [...container.querySelectorAll('.sf-field-picker-popover__item-label')].map((n) => n.textContent);
    act(() => root.unmount());
    return labels;
  }

  it('leaves out a step and Tabs inside a Tabs panel', () => {
    const labels = labelsAt('t1p1');
    expect(labels).not.toContain('Page Break');
    expect(labels).not.toContain('Tabs');
    expect(labels).toContain('Accordion');
    expect(labels).toContain('Text');
  });

  it('leaves out a step and Accordion inside an Accordion panel', () => {
    const labels = labelsAt('a1p1');
    expect(labels).not.toContain('Page Break');
    expect(labels).not.toContain('Accordion');
    expect(labels).toContain('Tabs');
  });

  it('offers everything at the root', () => {
    expect(labelsAt('root')).toEqual(['Page Break', 'Tabs', 'Accordion', 'Text']);
  });
});
