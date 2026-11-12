/**
 * The settings panel honours the control keys add-ons send: `default` (shown
 * until a value is saved), `placeholder` on number controls and `disabled`.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DynamicInspectorPanel from '../DynamicInspectorPanel';
import { ConfigContext } from '../../context/ConfigContext';
import { TreeContext } from '../../context/TreeContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const CONTROLS = {
  flag: { type: 'toggle', name: 'flag', label: 'Flag', default: true },
  mode: {
    type: 'select',
    name: 'mode',
    label: 'Mode',
    default: 'b',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ],
  },
  size: { type: 'number', name: 'size', label: 'Size', placeholder: '280' },
  count: { type: 'number', name: 'count', label: 'Count', default: 5 },
  note: { type: 'text', name: 'note', label: 'Note', placeholder: 'Type here', default: 'hello' },
  area: { type: 'textarea', name: 'area', label: 'Area', placeholder: 'Write here' },
};

function mount(controls, field = {}, { isReadOnly = false } = {}) {
  const onUpdate = jest.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const full = { id: 'n1', key: 'x_1', type: 'probe', ...field };
  act(() =>
    root.render(
      <ConfigContext.Provider value={{ fieldDefinitions: { probe: { inspectorControls: controls } } }}>
        <TreeContext.Provider value={{ rootId: 'root', nodes: {} }}>
          <DynamicInspectorPanel field={full} onUpdate={onUpdate} isReadOnly={isReadOnly} />
        </TreeContext.Provider>
      </ConfigContext.Provider>
    )
  );
  return {
    container,
    onUpdate,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const byLabel = (container, text) =>
  [...container.querySelectorAll('label.sf-prow__label')].find((l) => l.textContent.trim() === text);
const inputFor = (container, text) => container.querySelector(`#${byLabel(container, text).htmlFor}`);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('default', () => {
  test('a toggle with default true and no saved value is on, and writes false when clicked', () => {
    const h = mount([CONTROLS.flag]);
    const box = inputFor(h.container, 'Flag');
    expect(box.checked).toBe(true);
    expect(h.onUpdate).not.toHaveBeenCalled();
    act(() => box.click());
    expect(h.onUpdate).toHaveBeenCalledWith({ flag: false });
    h.unmount();
  });

  test('the same toggle with a saved false is off', () => {
    const h = mount([CONTROLS.flag], { flag: false });
    expect(inputFor(h.container, 'Flag').checked).toBe(false);
    h.unmount();
  });

  test('a saved empty string or zero does not fall back to the default', () => {
    const h = mount([CONTROLS.count, CONTROLS.note], { count: 0, note: '' });
    expect(inputFor(h.container, 'Count').value).toBe('0');
    expect(inputFor(h.container, 'Note').value).toBe('');
    h.unmount();
  });

  test('a select shows its default option', () => {
    const h = mount([CONTROLS.mode]);
    expect(h.container.querySelector('input[type="radio"][value="b"]').checked).toBe(true);
    h.unmount();
  });

  test('a saved select value wins over the default', () => {
    const h = mount([CONTROLS.mode], { mode: 'c' });
    expect(h.container.querySelector('input[type="radio"][value="c"]').checked).toBe(true);
    h.unmount();
  });

  test('a number and a text input show their default as the value', () => {
    const h = mount([CONTROLS.count, CONTROLS.note]);
    expect(inputFor(h.container, 'Count').value).toBe('5');
    expect(inputFor(h.container, 'Note').value).toBe('hello');
    expect(h.onUpdate).not.toHaveBeenCalled();
    h.unmount();
  });
});

describe('placeholder', () => {
  test('a number control shows its placeholder', () => {
    const h = mount([CONTROLS.size]);
    expect(inputFor(h.container, 'Size').getAttribute('placeholder')).toBe('280');
    h.unmount();
  });

  test('text and textarea controls show theirs', () => {
    const h = mount([{ ...CONTROLS.note, default: undefined }, CONTROLS.area]);
    expect(inputFor(h.container, 'Note').getAttribute('placeholder')).toBe('Type here');
    expect(h.container.querySelector('textarea').getAttribute('placeholder')).toBe('Write here');
    h.unmount();
  });
});

describe('disabled', () => {
  const HELP = 'Needs a setting first.';
  const disabledControls = [
    { ...CONTROLS.flag, disabled: true, help: HELP },
    { ...CONTROLS.note, default: undefined, disabled: true },
    { ...CONTROLS.mode, disabled: true },
    {
      type: 'select',
      name: 'long',
      label: 'Long',
      disabled: true,
      options: ['one', 'two', 'three', 'four', 'five'].map((v) => ({ value: v, label: v })),
    },
  ];

  test('disabled true disables a toggle, a text input, a segmented control and a select', () => {
    const h = mount(disabledControls);
    expect(inputFor(h.container, 'Flag').disabled).toBe(true);
    expect(inputFor(h.container, 'Note').disabled).toBe(true);
    const radios = [...h.container.querySelectorAll('input[type="radio"]')];
    expect(radios.length).toBe(3);
    radios.forEach((r) => expect(r.disabled).toBe(true));
    expect(h.container.querySelector('[role="radiogroup"]').getAttribute('aria-disabled')).toBe('true');
    const select = h.container.querySelector('select');
    expect(select.disabled).toBe(true);
    expect(select.getAttribute('aria-disabled')).toBe('true');
    h.unmount();
  });

  test('the help icon of a disabled control stays usable', () => {
    const h = mount(disabledControls);
    const tip = h.container.querySelector('.sf-prow__head button');
    expect(tip).not.toBeNull();
    expect(tip.disabled).toBe(false);
    expect(tip.getAttribute('aria-disabled')).not.toBe('true');
    act(() => tip.focus());
    expect(document.activeElement).toBe(tip);
    h.unmount();
  });

  test('a disabled control writes nothing', () => {
    const h = mount(disabledControls);
    act(() => inputFor(h.container, 'Flag').click());
    act(() => h.container.querySelector('input[type="radio"][value="a"]').click());
    expect(h.onUpdate).not.toHaveBeenCalled();
    h.unmount();
  });

  test('a control that is not disabled stays usable', () => {
    const h = mount([CONTROLS.flag, CONTROLS.mode]);
    expect(inputFor(h.container, 'Flag').disabled).toBe(false);
    h.container.querySelectorAll('input[type="radio"]').forEach((r) => expect(r.disabled).toBe(false));
    h.unmount();
  });

  test('read-only still disables everything', () => {
    const h = mount([CONTROLS.flag, CONTROLS.note, CONTROLS.mode, CONTROLS.size], {}, { isReadOnly: true });
    expect(inputFor(h.container, 'Flag').disabled).toBe(true);
    expect(inputFor(h.container, 'Note').disabled).toBe(true);
    expect(inputFor(h.container, 'Size').disabled).toBe(true);
    h.container.querySelectorAll('input[type="radio"]').forEach((r) => expect(r.disabled).toBe(true));
    h.unmount();
  });
});
