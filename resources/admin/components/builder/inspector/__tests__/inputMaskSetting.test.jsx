/**
 * Input mask setting (2.8.0) in the field inspector: the select, the
 * conditional Pattern and Save as controls, and the Try it box.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DynamicInspectorPanel from '../DynamicInspectorPanel';
import { ConfigContext } from '../../context/ConfigContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

const options = [
  { value: '', label: 'None' },
  { value: 'date_dmy', label: 'Date DD/MM/YYYY' },
  { value: 'custom', label: 'Custom' },
];

const definition = {
  inspectorControls: [
    { type: 'select', name: 'inputMask', label: 'Input mask', options, section: 'validation' },
    { type: 'text', name: 'maskPattern', label: 'Pattern', section: 'validation', showWhen: { inputMask: ['custom'] } },
    { type: 'mask_try', name: 'maskTry', label: 'Try it', section: 'validation', showWhen: { inputMask: ['date_dmy', 'custom'] } },
    { type: 'select', name: 'maskStore', label: 'Save as', section: 'validation', options: [{ value: 'typed', label: 'Save as typed' }, { value: 'digits', label: 'Save digits only' }], showWhen: { inputMask: ['custom'] } },
  ],
};

function mount(field, onUpdate = () => {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ConfigContext.Provider value={{ fieldDefinitions: { text: definition } }}>
        <DynamicInspectorPanel field={field} onUpdate={onUpdate} sections={['validation']} />
      </ConfigContext.Provider>
    )
  );
  return container;
}

const labels = (c) => [...c.querySelectorAll('label')].map((l) => l.textContent);

describe('Input mask setting', () => {
  it('shows only the select when no mask is chosen', () => {
    const c = mount({ type: 'text', id: 'a' });
    expect(labels(c)).toEqual(['Input mask']);
  });

  it('shows Try it for a preset, without Pattern or Save as', () => {
    const c = mount({ type: 'text', id: 'a', inputMask: 'date_dmy' });
    expect(labels(c)).toEqual(['Input mask', 'Try it']);
  });

  it('shows Pattern, Try it and Save as for Custom', () => {
    const c = mount({ type: 'text', id: 'a', inputMask: 'custom', maskPattern: 'AA-9999' });
    expect(labels(c)).toEqual(['Input mask', 'Pattern', 'Try it', 'Save as']);
  });

  it('saves the choice on the field', () => {
    const onUpdate = jest.fn();
    const c = mount({ type: 'text', id: 'a' }, onUpdate);
    const select = c.querySelector('select');
    act(() => {
      select.value = 'custom';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onUpdate).toHaveBeenCalledWith({ inputMask: 'custom' });
  });

  it('applies the mask live in the Try it box without saving it', () => {
    const onUpdate = jest.fn();
    const c = mount({ type: 'text', id: 'a', inputMask: 'custom', maskPattern: 'AA-9999' }, onUpdate);
    const input = c.querySelector('.sf-mask-try input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'ab12345');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.value).toBe('ab-1234');
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
