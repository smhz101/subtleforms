/**
 * Dropdown type-ahead and the search box on long lists (issue 146).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import axe from 'axe-core';
import ChoiceSelect from './ChoiceSelect';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

const numbered = (count) => Array.from({ length: count }, (_, i) => `Option ${i + 1}`);

function mount(options, props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = jest.fn();
  act(() => root.render(
    <div>
      <label htmlFor='dd'>Choice</label>
      <ChoiceSelect inputId='dd' name='dd' value='' onChange={onChange} options={options} {...props} />
    </div>
  ));
  return {
    container,
    onChange,
    trigger: container.querySelector('#dd'),
    unmount: () => act(() => root.unmount()),
  };
}

function key(target, name, init = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
  });
}

const type = (target, text) => {
  for (const character of text) {
    key(target, character);
  }
};

const activeText = (container) => container.querySelector('[data-active="true"]')?.textContent;
const searchOf = (container) => container.querySelector('.subtleforms-picker__search');

describe('type-ahead without a search box', () => {
  test('the first letter typed on a closed trigger is not lost', () => {
    const { container, trigger } = mount(['Apple', 'Banana', 'Cherry']);
    key(trigger, 'c');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(activeText(container)).toBe('Cherry');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(container.querySelector('[data-active="true"]').id);
  });

  test('a space is part of the buffer and a long buffer matches', () => {
    const labels = ['Branch Lahore', 'Branch Karachi', 'Branch Islamabad', 'Regional office Peshawar'];
    const { container, trigger } = mount(labels);
    type(trigger, 'Branch K');
    expect(activeText(container)).toBe('Branch Karachi');
    jest.advanceTimersByTime(1100);
    type(trigger, 'Regional office P');
    expect(activeText(container)).toBe('Regional office Peshawar');
  });

  test('the buffer resets after one second and not before', () => {
    const { container, trigger } = mount(['Apple', 'Avocado', 'Banana']);
    key(trigger, 'b');
    jest.advanceTimersByTime(900);
    key(trigger, 'a');
    expect(activeText(container)).toBe('Banana');
    jest.advanceTimersByTime(1100);
    key(trigger, 'a');
    expect(activeText(container)).toBe('Apple');
  });

  test('a space on a closed trigger with nothing typed still opens the list', () => {
    const { trigger } = mount(['Apple', 'Banana']);
    key(trigger, ' ');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  test('accents are ignored and the same letter cycles', () => {
    const { container, trigger } = mount(['Apple', 'École', 'Eagle', 'Zebra']);
    key(trigger, 'e');
    expect(activeText(container)).toBe('École');
    jest.advanceTimersByTime(1100);
    key(trigger, 'e');
    expect(activeText(container)).toBe('Eagle');
  });

  test('a 10-option list has no search box', () => {
    const { container, trigger } = mount(numbered(10));
    act(() => trigger.click());
    expect(searchOf(container)).toBeNull();
    expect(trigger.getAttribute('aria-activedescendant')).toBeTruthy();
  });

  test('15 options still have no search box', () => {
    const { container, trigger } = mount(numbered(15));
    act(() => trigger.click());
    expect(searchOf(container)).toBeNull();
  });

  test('opening by click still starts on the selected option', () => {
    const { container, trigger } = mount(['Apple', 'Banana', 'Cherry'], { value: 'Cherry' });
    act(() => trigger.click());
    expect(activeText(container)).toBe('Cherry');
  });
});

describe('search box on long lists', () => {
  test('a 16-option list shows the search box, focused, on open', () => {
    const { container, trigger } = mount(numbered(16));
    act(() => trigger.click());
    const search = searchOf(container);
    expect(search).not.toBeNull();
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('placeholder')).toBe('Search options');
    expect(search.getAttribute('aria-label')).toBe('Search options');
    expect(search.getAttribute('aria-activedescendant')).toBe(container.querySelector('[data-active="true"]').id);
  });

  test('typing "Option 37" on a closed trigger of a 500-option list makes option 37 active', () => {
    const { container, trigger } = mount(numbered(500));
    type(trigger, 'Option 37');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const active = container.querySelector('[data-active="true"]');
    expect(active.textContent).toBe('Option 37');
    expect(searchOf(container).getAttribute('aria-activedescendant')).toBe(active.id);
  });

  test('typing in the search filters the list, case and accents ignored', () => {
    const labels = [...numbered(20), 'École normale'];
    const { container, trigger } = mount(labels);
    act(() => trigger.click());
    const search = searchOf(container);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    act(() => {
      setValue.call(search, 'ECOLE');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const options = [...container.querySelectorAll('[role="option"]')].map((el) => el.textContent);
    expect(options).toEqual(['École normale']);
    act(() => {
      setValue.call(search, '');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(21);
  });

  test('arrows move through the filtered list and Enter picks the active one', () => {
    const { container, trigger, onChange } = mount(numbered(40));
    act(() => trigger.click());
    const search = searchOf(container);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    act(() => {
      setValue.call(search, 'Option 3');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(activeText(container)).toBe('Option 3');
    key(search, 'ArrowDown');
    expect(activeText(container)).toBe('Option 30');
    key(search, 'Enter');
    expect(onChange).toHaveBeenCalledWith('Option 30');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('Escape closes the list and gives focus back to the trigger', () => {
    const { container, trigger } = mount(numbered(30));
    act(() => trigger.click());
    key(searchOf(container), 'Escape');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('no match shows the empty text', () => {
    const { container, trigger } = mount(numbered(30));
    act(() => trigger.click());
    const search = searchOf(container);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    act(() => {
      setValue.call(search, 'zzz');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('.subtleforms-picker__empty').textContent).toBe('No options match that search.');
    expect(search.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('the open list with the search box has no axe violations', async () => {
    jest.useRealTimers();
    const { container, trigger } = mount(numbered(40));
    act(() => trigger.click());
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`)).toEqual([]);
  });
});
