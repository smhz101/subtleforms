/**
 * WP2-03: the advanced logic operators are offered in the free plugin's
 * editor with no lock, label or upgrade prompt.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import LogicEditor from './LogicEditor';

jest.mock('./LogicEditor.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const fields = [{ key: 'name', label: 'Name', type: 'text' }];
const logic = {
  action: 'show',
  groups: [{ rules: [{ field: 'name', operator: 'starts_with', value: 'A' }] }],
};

function mount(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<LogicEditor logic={logic} availableFields={fields} onChange={() => {}} {...props} />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('advanced logic operators in the editor (WP2-03)', () => {
  test('a text field offers starts with, ends with, is one of and the other advanced operators', () => {
    const { container, unmount } = mount();
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'starts_with'));
    expect(select).toBeDefined();
    const values = [...select.options].map((o) => o.value);
    ['starts_with', 'ends_with', 'in', 'not_in'].forEach((op) => expect(values).toContain(op));
    expect(select.disabled).toBe(false);
    [...select.options].forEach((o) => expect(o.disabled).toBe(false));
    unmount();
  });

  test('nothing in the editor is marked Pro or locked', () => {
    const { container, unmount } = mount();
    expect(container.textContent).not.toMatch(/\bPro\b|upgrade|locked/i);
    expect(container.querySelector('[aria-disabled="true"], .is-locked')).toBeNull();
    unmount();
  });

  test('choosing an advanced operator is passed on', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount({ onChange });
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'ends_with'));
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'ends_with');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalled();
    expect(JSON.stringify(onChange.mock.calls[0][0])).toContain('ends_with');
    unmount();
  });
});
