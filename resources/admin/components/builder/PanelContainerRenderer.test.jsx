/**
 * Tabs and Accordion on the builder canvas (2.9.0).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import PanelContainerRenderer from './PanelContainerRenderer';
import PanelSelectInspectorControl from './inspector/controls/PanelSelectInspectorControl';
import { BuilderProvider } from './context/BuilderProvider';
import { normalizeSchema } from './utils/schemaTree';

jest.mock('./ContainerRenderer.scss', () => ({}));
jest.mock('./PanelContainerRenderer.scss', () => ({}));
jest.mock('./FieldToolbar.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const treeFor = (type, panelType, count) =>
  normalizeSchema({
    schema_version: 1,
    fields: [
      {
        id: 'box',
        key: 'box',
        type,
        label: 'Box',
        children: Array.from({ length: count }, (_, i) => ({
          id: `p${i + 1}`,
          key: `p${i + 1}`,
          type: panelType,
          label: `Panel ${i + 1}`,
          children: [],
        })),
      },
    ],
  });

let root;
let container;

function mount(tree, { selectedId = null, handlers = {} } = {}) {
  const setSelectedId = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const node = tree.nodes.box;
  act(() =>
    root.render(
      <BuilderProvider
        tree={tree}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        selectedStepId={null}
        setSelectedStepId={() => {}}
        onMove={handlers.onMove}
        onAddPanel={handlers.onAddPanel}
        onDeletePanel={handlers.onDeletePanel}>
        <PanelContainerRenderer
          node={node}
          isSelected={false}
          onSelect={() => {}}
          onDelete={() => {}}
          renderPanelBody={(id) => <div data-testid={`body-${id}`}>body {id}</div>}
        />
      </BuilderProvider>
    )
  );
  return { setSelectedId };
}

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('Tabs canvas', () => {
  it('draws a tab strip and opens the first tab', () => {
    mount(treeFor('tabs_container', 'tab_panel', 3));
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Panel 1', 'Panel 2', 'Panel 3']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(container.querySelector('[data-testid="body-p1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="body-p2"]')).toBeNull();
  });

  it('selects a tab and opens it to drop into', () => {
    const { setSelectedId } = mount(treeFor('tabs_container', 'tab_panel', 3));
    act(() => container.querySelectorAll('[role="tab"]')[1].click());
    expect(setSelectedId).toHaveBeenCalledWith('p2');
    expect(container.querySelector('[data-testid="body-p2"]')).not.toBeNull();
  });

  it('keeps the panel that holds the selection open', () => {
    mount(treeFor('tabs_container', 'tab_panel', 3), { selectedId: 'p3' });
    expect(container.querySelector('[data-testid="body-p3"]')).not.toBeNull();
  });

  it('adds a tab with the control after the last one', () => {
    const onAddPanel = jest.fn();
    mount(treeFor('tabs_container', 'tab_panel', 2), { handlers: { onAddPanel } });
    const add = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Add tab');
    act(() => add.click());
    expect(onAddPanel).toHaveBeenCalledWith('box');
  });

  it('offers delete on the selected tab, and not on the last remaining one', () => {
    const onDeletePanel = jest.fn();
    mount(treeFor('tabs_container', 'tab_panel', 2), { selectedId: 'p1', handlers: { onDeletePanel } });
    const del = container.querySelector('button[aria-label="Delete this tab"]');
    act(() => del.click());
    expect(onDeletePanel).toHaveBeenCalledWith('p1');
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount(treeFor('tabs_container', 'tab_panel', 1), { selectedId: 'p1', handlers: { onDeletePanel } });
    expect(container.querySelector('button[aria-label="Delete this tab"]')).toBeNull();
  });

  it('moves a selected tab later', () => {
    const onMove = jest.fn();
    mount(treeFor('tabs_container', 'tab_panel', 3), { selectedId: 'p1', handlers: { onMove } });
    act(() => container.querySelector('button[aria-label="Move tab later"]').click());
    expect(onMove).toHaveBeenCalledWith('p1', { parentId: 'box', columnIndex: null, position: 1 });
    expect(container.querySelector('button[aria-label="Move tab earlier"]').disabled).toBe(true);
  });
});

describe('Accordion canvas', () => {
  it('stacks sections and opens one', () => {
    mount(treeFor('accordion_container', 'accordion_panel', 2));
    const triggers = [...container.querySelectorAll('button[aria-expanded]')];
    expect(triggers.map((t) => t.textContent)).toEqual(['Panel 1', 'Panel 2']);
    expect(triggers.map((t) => t.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    act(() => triggers[1].click());
    expect(triggers.map((t) => t.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect(container.querySelector('[data-testid="body-p2"]')).not.toBeNull();
  });

  it('adds a section', () => {
    const onAddPanel = jest.fn();
    mount(treeFor('accordion_container', 'accordion_panel', 2), { handlers: { onAddPanel } });
    const add = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Add section');
    act(() => add.click());
    expect(onAddPanel).toHaveBeenCalledWith('box');
  });
});

describe('Tab shown first', () => {
  it('lists the panel titles and stores the position', () => {
    const onChange = jest.fn();
    const field = { children: [{ label: 'Alpha' }, { label: 'Beta' }] };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<PanelSelectInspectorControl label='Tab shown first' value={0} field={field} onChange={onChange} />));
    const select = container.querySelector('select');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Alpha', 'Beta']);
    act(() => {
      select.value = '1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
