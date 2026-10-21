/**
 * Tests for fixes that shipped before 2.5.0 without one: the radio roles of
 * the chained field settings (FLD2-14) and the Move to menu on a Repeater
 * toolbar (FLD2-19).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ContainerRenderer from './ContainerRenderer';
import ChainedDisplayControl from './inspector/controls/ChainedDisplayControl';
import ChainedSourceControl from './inspector/controls/ChainedSourceControl';

jest.mock('./ContainerRenderer.scss', () => ({}));
jest.mock('./FieldToolbar.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('chained field settings are radio groups (FLD2-14)', () => {
  test('On the form is a named radio group and the choice is announced as checked', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(<ChainedDisplayControl value='buttons' onChange={onChange} />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group.getAttribute('aria-label')).toBe('On the form');
    const radios = [...group.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(['Dropdowns', 'Buttons', 'Columns']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    act(() => radios[2].click());
    expect(onChange).toHaveBeenCalledWith('columns');
    unmount();
  });

  test('Source is a named radio group with Manual and CSV', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(<ChainedSourceControl field={{ type: 'chained_select' }} onChange={onChange} />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group.getAttribute('aria-label')).toBe('Source');
    const radios = [...group.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(['Manual', 'CSV']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    act(() => radios[1].click());
    expect(onChange).toHaveBeenCalledWith({ source: 'csv', sourceChosen: true });
    unmount();
  });

  test('a disabled control does not change', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(<ChainedSourceControl field={{}} onChange={onChange} disabled />);
    const radio = container.querySelectorAll('[role="radio"]')[1];
    expect(radio.disabled).toBe(true);
    unmount();
  });
});

describe('Repeater toolbar has Move to (FLD2-19)', () => {
  const node = { id: 'rep1', type: 'repeat_container', config: { label: 'People', min: 1, max: 3 }, children: [] };
  const actions = (extra = {}) => ({
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    onDuplicate: jest.fn(),
    onDelete: jest.fn(),
    canMoveUp: true,
    canMoveDown: true,
    width: '100',
    onWidthChange: jest.fn(),
    ...extra,
  });

  const render = (toolbarActions, nodeOverride = node) => mount(
    <ContainerRenderer
      node={nodeOverride}
      columns={[[]]}
      isSelected
      onSelect={() => {}}
      onDelete={() => {}}
      renderColumn={() => null}
      spacing='16'
      toolbarActions={toolbarActions}
    />
  );

  test('a selected Repeater shows Move to when it has somewhere to go', () => {
    const onMoveTo = jest.fn();
    const { container, unmount } = render(
      actions({ moveTargets: [{ parentId: 'cols1', columnIndex: 0, depth: 0, label: 'Columns, column 1' }], onMoveTo })
    );
    expect(container.querySelector('button[aria-label="Move to"]')).not.toBeNull();
    unmount();
  });

  test('a Repeater with nowhere to go has no Move to', () => {
    const { container, unmount } = render(actions({ moveTargets: [], onMoveTo: jest.fn() }));
    expect(container.querySelector('button[aria-label="Move to"]')).toBeNull();
    unmount();
  });

  test('the Repeater toolbar keeps its other actions', () => {
    const { container, unmount } = render(actions({ moveTargets: [], onMoveTo: jest.fn() }));
    const labels = [...container.querySelectorAll('.sf-field-toolbar button')].map((b) => b.getAttribute('aria-label') || b.getAttribute('title') || '');
    expect(labels.join('|')).toMatch(/Duplicate/i);
    expect(labels.join('|')).toMatch(/Delete/i);
    unmount();
  });
});
