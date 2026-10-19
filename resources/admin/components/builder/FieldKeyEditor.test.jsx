/**
 * Field ID editor in the field settings header (2.4.1).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldKeyEditor from './FieldKeyEditor';

jest.mock('./FieldKeyEditor.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (next) => act(() => root.render(<FieldKeyEditor nodeId='n1' fieldKey='email_ab12' usedKeys={new Set(['name_x'])} {...props} {...next} />));
  render();
  return { container, render, unmount: () => act(() => root.unmount()) };
}

function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function key(input, name) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

const editButton = (container) => container.querySelector('button[aria-label="Change field ID"]');

describe('FieldKeyEditor', () => {
  test('shows the ID with a quiet edit button, hidden when read only', () => {
    const { container, render, unmount } = mount({ onRename: () => ({ references: 0 }) });
    expect(container.textContent).toContain('email_ab12');
    expect(editButton(container)).not.toBeNull();
    render({ isReadOnly: true });
    expect(editButton(container)).toBeNull();
    unmount();
  });

  test('edits inline, tidies typing, explains problems and saves on Enter', () => {
    const onRename = jest.fn(() => ({ references: 3 }));
    const { container, unmount } = mount({ onRename, entryCount: 2 });
    act(() => editButton(container).click());
    const input = container.querySelector('input');
    expect(document.activeElement).toBe(input);

    type(input, 'Name X');
    expect(input.value).toBe('name_x');
    expect(container.textContent).toContain('Another field in this form already uses this ID.');
    key(input, 'Enter');
    expect(onRename).not.toHaveBeenCalled();

    type(input, '9lives');
    expect(container.textContent).toContain('Start the ID with a letter.');

    type(input, 'form_rendered_at');
    expect(container.textContent).toContain('SubtleForms uses this name itself.');

    type(input, 'customer_email');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    key(input, 'Enter');
    expect(onRename).toHaveBeenCalledWith('n1', 'customer_email');
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('ID changed, 3 places updated.');
    expect(container.textContent).toContain('Earlier entries keep email_ab12.');
    unmount();
  });

  test('Escape cancels without renaming', () => {
    const onRename = jest.fn();
    const { container, unmount } = mount({ onRename });
    act(() => editButton(container).click());
    const input = container.querySelector('input');
    type(input, 'other');
    key(input, 'Escape');
    expect(onRename).not.toHaveBeenCalled();
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('email_ab12');
    unmount();
  });

  test('Undo renames back to the previous ID', () => {
    const onRename = jest.fn(() => ({ references: 0 }));
    const { container, unmount } = mount({ onRename });
    act(() => editButton(container).click());
    const input = container.querySelector('input');
    type(input, 'contact');
    key(input, 'Enter');
    expect(container.textContent).toContain('ID changed.');
    expect(container.textContent).not.toContain('Earlier entries');
    const undo = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Undo');
    act(() => undo.click());
    expect(onRename).toHaveBeenLastCalledWith('n1', 'email_ab12');
    expect(container.textContent).not.toContain('ID changed');
    unmount();
  });
});
