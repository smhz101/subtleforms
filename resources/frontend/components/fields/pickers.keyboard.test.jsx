/**
 * Keyboard and screen reader behaviour of the pickers (FLD2-04, FLD2-05,
 * FLD2-06): the date and time dialog, the Country search and the phone
 * country list.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DateTimeField from './DateTimeField';
import CountrySelect from './CountrySelect';
import ChoiceSelect from './ChoiceSelect';
import PhoneField from './PhoneField';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  // jsdom does not scroll.
  Element.prototype.scrollIntoView = () => {};
});

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

function key(target, name, init = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
  });
}

const click = (el) => act(() => el.click());

describe('time picker (FLD2-05)', () => {
  function setup(props = {}) {
    const onChange = jest.fn();
    const view = mount(
      <DateTimeField mode='time' inputId='t1' name='t' value='' onChange={onChange} format='H:i' {...props} />
    );
    const trigger = view.container.querySelector('#t1');
    return { ...view, onChange, trigger };
  }

  test('opening moves focus into the dialog, onto the hour column', () => {
    const { container, trigger, unmount } = setup();
    click(trigger);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement.getAttribute('role')).toBe('option');
    expect(document.activeElement.closest('[role="listbox"]').getAttribute('aria-label')).toBe('Hour');
    unmount();
  });

  test('each column is one tab stop and the arrows, Home and End move inside it', () => {
    const { container, trigger, unmount } = setup({ value: '09:30' });
    click(trigger);
    const hours = container.querySelector('[role="listbox"][aria-label="Hour"]');
    const stops = hours.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].textContent).toBe('09');
    expect(document.activeElement).toBe(stops[0]);

    key(document.activeElement, 'ArrowDown');
    expect(document.activeElement.textContent).toBe('10');
    expect(hours.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    key(document.activeElement, 'End');
    expect(document.activeElement.textContent).toBe('23');
    key(document.activeElement, 'Home');
    expect(document.activeElement.textContent).toBe('00');
    key(document.activeElement, 'ArrowUp');
    expect(document.activeElement.textContent).toBe('00');
    unmount();
  });

  test('Enter and Space pick the focused hour and minute', () => {
    const { container, trigger, onChange, unmount } = setup({ value: '09:30' });
    click(trigger);
    key(document.activeElement, 'ArrowDown');
    key(document.activeElement, 'Enter');
    expect(onChange).toHaveBeenLastCalledWith('10:30');

    key(document.activeElement, 'ArrowRight');
    const minutes = container.querySelector('[role="listbox"][aria-label="Minute"]');
    expect(minutes.contains(document.activeElement)).toBe(true);
    expect(document.activeElement.textContent).toBe('30');
    key(document.activeElement, 'ArrowDown');
    key(document.activeElement, ' ');
    expect(onChange).toHaveBeenLastCalledWith('09:31');
    key(document.activeElement, 'ArrowLeft');
    expect(document.activeElement.closest('[role="listbox"]').getAttribute('aria-label')).toBe('Hour');
    unmount();
  });

  test('Escape closes the dialog and returns focus to the trigger', () => {
    const { container, trigger, unmount } = setup();
    click(trigger);
    key(document.activeElement, 'Escape');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  test('the trigger opens with the arrow keys', () => {
    const { container, trigger, unmount } = setup();
    trigger.focus();
    key(trigger, 'ArrowDown');
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    unmount();
  });
});

describe('date picker (FLD2-05)', () => {
  test('focus lands on the day, arrows move it across months, Enter picks, focus returns', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <DateTimeField mode='date' inputId='d1' name='d' value='2025-03-31' onChange={onChange} format='Y-m-d' />
    );
    const trigger = container.querySelector('#d1');
    click(trigger);
    expect(document.activeElement.getAttribute('role')).toBe('gridcell');
    expect(document.activeElement.getAttribute('aria-label')).toMatch(/31/);

    key(document.activeElement, 'ArrowRight');
    expect(document.activeElement.getAttribute('aria-label')).toMatch(/April 1/);
    key(document.activeElement, 'PageDown');
    expect(document.activeElement.getAttribute('aria-label')).toMatch(/May 1/);
    key(document.activeElement, 'Enter');
    expect(onChange).toHaveBeenLastCalledWith('2025-05-01');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  test('Escape in the calendar returns focus to the trigger', () => {
    const { container, unmount } = mount(
      <DateTimeField mode='datetime' inputId='dt1' name='dt' value='' onChange={() => {}} />
    );
    const trigger = container.querySelector('#dt1');
    click(trigger);
    expect(container.querySelector('[role="dialog"]').contains(document.activeElement)).toBe(true);
    key(document.activeElement, 'Escape');
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  test('a day outside min and max can be reached but not picked', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <DateTimeField mode='date' inputId='d2' name='d' value='2025-03-10' min='2025-03-10' max='2025-03-20' onChange={onChange} />
    );
    click(container.querySelector('#d2'));
    key(document.activeElement, 'ArrowLeft');
    expect(document.activeElement.getAttribute('aria-disabled')).toBe('true');
    key(document.activeElement, 'Enter');
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });
});

describe('country search (FLD2-04)', () => {
  test('the search input is a combobox that names the active option', () => {
    const { container, unmount } = mount(
      <CountrySelect inputId='c1' name='c' value='' onChange={() => {}} />
    );
    click(container.querySelector('#c1'));
    const search = container.querySelector('input.subtleforms-picker__search');
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('role')).toBe('combobox');
    expect(search.getAttribute('aria-expanded')).toBe('true');
    const list = container.querySelector('[role="listbox"]');
    expect(search.getAttribute('aria-controls')).toBe(list.id);
    expect(list.contains(search)).toBe(false);
    const first = search.getAttribute('aria-activedescendant');
    expect(first).toBeTruthy();
    expect(container.querySelector(`#${first}`).getAttribute('role')).toBe('option');

    key(search, 'ArrowDown');
    const second = search.getAttribute('aria-activedescendant');
    expect(second).not.toBe(first);
    expect(container.querySelector(`#${second}`).getAttribute('data-active')).toBe('true');
    unmount();
  });

  test('Escape in the search closes the list and focuses the trigger, not the page body', () => {
    const { container, unmount } = mount(
      <CountrySelect inputId='c2' name='c' value='' onChange={() => {}} />
    );
    const trigger = container.querySelector('#c2');
    click(trigger);
    key(document.activeElement, 'Escape');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  test('Enter picks the active country and focus returns to the trigger', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <CountrySelect inputId='c3' name='c' value='' onChange={onChange} />
    );
    const trigger = container.querySelector('#c3');
    click(trigger);
    key(document.activeElement, 'Enter');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  test('without search the trigger keeps focus and carries the active option', () => {
    const { container, unmount } = mount(
      <CountrySelect inputId='c4' name='c' value='' onChange={() => {}} searchable={false} />
    );
    const trigger = container.querySelector('#c4');
    trigger.focus();
    click(trigger);
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector(`#${trigger.getAttribute('aria-activedescendant')}`)).not.toBeNull();
    unmount();
  });
});

describe('phone country list (FLD2-04)', () => {
  test('the search is a combobox with an active option, Escape returns to the trigger', () => {
    const { container, unmount } = mount(
      <PhoneField inputId='p1' name='p' config={{ countryCodes: true }} value='' onChange={() => {}} />
    );
    const trigger = container.querySelector('.subtleforms-phone__trigger');
    expect(trigger.getAttribute('aria-controls')).toBeNull();
    click(trigger);
    const search = container.querySelector('.subtleforms-phone__search');
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('role')).toBe('combobox');
    expect(search.getAttribute('aria-controls')).toBe(container.querySelector('[role="listbox"]').id);
    const first = search.getAttribute('aria-activedescendant');
    expect(container.querySelector(`[id="${first}"]`).getAttribute('role')).toBe('option');
    key(search, 'ArrowDown');
    expect(search.getAttribute('aria-activedescendant')).not.toBe(first);

    key(search, 'Escape');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount();
  });
});

describe('required pickers (FLD2-06)', () => {
  test.each([
    ['Dropdown', <ChoiceSelect key='a' inputId='r1' name='a' value='' onChange={() => {}} options={['A', 'B']} required />],
    ['Country', <CountrySelect key='b' inputId='r1' name='a' value='' onChange={() => {}} required />],
    ['Date', <DateTimeField key='c' mode='date' inputId='r1' name='a' value='' onChange={() => {}} required />],
    ['Time', <DateTimeField key='d' mode='time' inputId='r1' name='a' value='' onChange={() => {}} required />],
    ['Date and time', <DateTimeField key='e' mode='datetime' inputId='r1' name='a' value='' onChange={() => {}} required />],
  ])('%s trigger is a combobox marked required', (_, element) => {
    const { container, unmount } = mount(element);
    const trigger = container.querySelector('#r1');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    unmount();
  });

  test('an optional picker is not marked required, an invalid one is marked invalid', () => {
    const { container, unmount } = mount(
      <DateTimeField mode='date' inputId='r2' name='a' value='' onChange={() => {}} invalid />
    );
    const trigger = container.querySelector('#r2');
    expect(trigger.getAttribute('aria-required')).toBeNull();
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    unmount();
  });
});
