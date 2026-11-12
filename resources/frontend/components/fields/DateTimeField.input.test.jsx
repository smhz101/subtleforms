/**
 * 2.9.0: the Date, Time and Date & time control is a real text input. It shows
 * the value in the field's format, reads typed text on blur or Enter, and
 * opens its popover from the icon button, ArrowDown or a click when empty.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DateTimeField from './DateTimeField';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  delete window.subtleformsFrontend;
  document.body.innerHTML = '';
});

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = jest.fn();
  const render = (next = {}) => act(() => root.render(
    <DateTimeField inputId='f1' name='f' value='' onChange={onChange} {...props} {...next} />
  ));
  render();
  return {
    container,
    onChange,
    render,
    input: () => container.querySelector('#f1'),
    unmount: () => act(() => root.unmount()),
  };
}

function type(input, text) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function blur(input) {
  act(() => {
    input.focus();
    input.blur();
  });
}

const key = (target, name, init = {}) => act(() => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
});

describe('the control is a text input', () => {
  test('a combobox input with a separate icon button, labelled for each type', () => {
    [['date', 'Open calendar'], ['time', 'Open time picker'], ['datetime', 'Open date and time picker']].forEach(([mode, label]) => {
      const view = mount({ mode });
      const input = view.input();
      expect(input.tagName).toBe('INPUT');
      expect(input.type).toBe('text');
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-haspopup')).toBe('dialog');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.classList.contains('subtleforms-input')).toBe(true);
      const button = view.container.querySelector('button.subtleforms-picker__open');
      expect(button.getAttribute('aria-label')).toBe(label);
      expect(button.getAttribute('tabindex')).toBe('-1');
      expect(button.parentElement).toBe(input.parentElement);
      view.unmount();
    });
  });

  test('is numeric for formats without names and plain text for named months', () => {
    let view = mount({ mode: 'date', format: 'd/m/Y' });
    expect(view.input().getAttribute('inputmode')).toBe('numeric');
    view.unmount();
    view = mount({ mode: 'date', format: 'j F Y' });
    expect(view.input().getAttribute('inputmode')).toBe('text');
    view.unmount();
  });

  test('shows the placeholder example of the format unless the field has its own', () => {
    let view = mount({ mode: 'date', format: 'd/m/Y' });
    expect(view.input().placeholder).toBe('13/11/2026');
    view.unmount();
    view = mount({ mode: 'time', format: 'H:i' });
    expect(view.input().placeholder).toBe('14:30');
    view.unmount();
    view = mount({ mode: 'date', format: 'd/m/Y', placeholder: 'Pick a day' });
    expect(view.input().placeholder).toBe('Pick a day');
    view.unmount();
  });

  test('shows the stored value in the field format', () => {
    let view = mount({ mode: 'date', format: 'j F Y', value: '2026-11-13' });
    expect(view.input().value).toBe('13 November 2026');
    view.unmount();
    view = mount({ mode: 'datetime', format: 'j F Y, g:i A', value: '2026-11-13T14:30' });
    expect(view.input().value).toBe('13 November 2026, 2:30 PM');
    view.unmount();
    view = mount({ mode: 'time', format: 'g:i A', value: '14:30' });
    expect(view.input().value).toBe('2:30 PM');
    view.unmount();
  });

  test('keeps the ISO value in a hidden input for a plain post', () => {
    const view = mount({ mode: 'date', format: 'd/m/Y', value: '2026-11-13' });
    const hidden = view.container.querySelector('input[type="hidden"][name="f"]');
    expect(hidden.value).toBe('2026-11-13');
    expect(view.input().getAttribute('name')).toBeNull();
    view.unmount();
  });

  test('site and custom formats resolve like the server does', () => {
    window.subtleformsFrontend = { dateFormat: 'j. F Y', timeFormat: 'H:i' };
    let view = mount({ mode: 'date', format: 'site', value: '2026-11-13' });
    expect(view.input().value).toBe('13. November 2026');
    view.unmount();
    view = mount({ mode: 'date', format: 'custom', customFormat: 'd-m-y', value: '2026-11-13' });
    expect(view.input().value).toBe('13-11-26');
    view.unmount();
  });
});

describe('typed entry', () => {
  test('a valid date is stored as ISO on blur and written back in the format', () => {
    const view = mount({ mode: 'date', format: 'd/m/Y' });
    type(view.input(), '13/11/2026');
    expect(view.onChange).not.toHaveBeenCalled();
    blur(view.input());
    expect(view.onChange).toHaveBeenLastCalledWith('2026-11-13');
    view.render({ value: '2026-11-13' });
    expect(view.input().value).toBe('13/11/2026');
    view.unmount();
  });

  test('Enter reads the text and does not submit the form', () => {
    const view = mount({ mode: 'time', format: 'g:i A' });
    type(view.input(), '2:30 pm');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => {
      view.input().dispatchEvent(event);
    });
    expect(view.onChange).toHaveBeenLastCalledWith('14:30');
    expect(event.defaultPrevented).toBe(true);
    view.unmount();
  });

  test('Enter with nothing typed is left alone so the form can submit', () => {
    const view = mount({ mode: 'time', value: '14:30' });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => {
      view.input().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    view.unmount();
  });

  test('a date and time field accepts a date and a time', () => {
    const view = mount({ mode: 'datetime', format: 'd/m/Y H:i' });
    type(view.input(), '13/11/2026 14:30');
    blur(view.input());
    expect(view.onChange).toHaveBeenLastCalledWith('2026-11-13T14:30');
    view.unmount();
  });

  test('clearing the text clears the value', () => {
    const view = mount({ mode: 'date', value: '2026-11-13' });
    type(view.input(), '');
    blur(view.input());
    expect(view.onChange).toHaveBeenLastCalledWith('');
    view.unmount();
  });

  test('text that is not a date is kept, marked invalid and handed on for the message', () => {
    const view = mount({ mode: 'date', format: 'd/m/Y' });
    type(view.input(), 'next friday');
    blur(view.input());
    expect(view.onChange).toHaveBeenLastCalledWith('next friday');
    view.render({ value: 'next friday' });
    expect(view.input().value).toBe('next friday');
    expect(view.input().getAttribute('aria-invalid')).toBe('true');
    view.unmount();
  });

  test('typing opens nothing', () => {
    const view = mount({ mode: 'date' });
    type(view.input(), '1');
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    view.unmount();
  });
});

describe('opening', () => {
  test('the icon button opens and closes it', () => {
    const view = mount({ mode: 'date' });
    const button = view.container.querySelector('.subtleforms-picker__open');
    act(() => button.click());
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.input().getAttribute('aria-expanded')).toBe('true');
    expect(view.input().getAttribute('aria-controls')).toBe(view.container.querySelector('[role="dialog"]').id);
    act(() => button.click());
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    view.unmount();
  });

  test('ArrowDown, also with Alt, opens it', () => {
    const view = mount({ mode: 'date' });
    view.input().focus();
    key(view.input(), 'ArrowDown', { altKey: true });
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    view.unmount();
  });

  test('a click opens it when the input is empty and not when it has a value', () => {
    let view = mount({ mode: 'date' });
    act(() => view.input().click());
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    view.unmount();
    view = mount({ mode: 'date', value: '2026-11-13' });
    act(() => view.input().click());
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    view.unmount();
  });

  test('a locked field does not open', () => {
    const view = mount({ mode: 'date', readOnly: true });
    act(() => view.input().click());
    key(view.input(), 'ArrowDown');
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(view.input().readOnly).toBe(true);
    view.unmount();
  });
});
