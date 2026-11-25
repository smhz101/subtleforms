/**
 * The time menu (#183): labelled columns, a marked selection, Now and Done.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DateTimeField from './DateTimeField';

global.IS_REACT_ACT_ENVIRONMENT = true;

function setup(props = {}) {
  const onChange = jest.fn();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <DateTimeField mode='time' inputId='t1' name='t' value='' onChange={onChange} format='H:i' {...props} />
  ));
  act(() => container.querySelector('.subtleforms-picker__open').click());
  return { container, onChange, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const button = (container, text) => [...container.querySelectorAll('button')].find((b) => b.textContent === text);

describe('time menu', () => {
  test('headings for the hour and minute columns', () => {
    const { container, unmount } = setup();
    const headings = [...container.querySelectorAll('.subtleforms-picker__col-heading')].map((el) => el.textContent);
    expect(headings).toEqual(['Hour', 'Minute']);
    unmount();
  });

  test('the current value is marked selected', () => {
    const { container, unmount } = setup({ value: '09:30' });
    const selected = [...container.querySelectorAll('[role="option"][aria-selected="true"]')];
    expect(selected.map((el) => el.textContent)).toEqual(['09', '30']);
    expect(selected.every((el) => el.classList.contains('is-selected'))).toBe(true);
    unmount();
  });

  test('Now sets a time', () => {
    const { container, onChange, unmount } = setup();
    act(() => button(container, 'Now').click());
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{2}:\d{2}$/));
    unmount();
  });

  test('Done closes the menu', () => {
    const { container, unmount } = setup();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => button(container, 'Done').click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  test('Now is disabled when the current time is outside the allowed range', () => {
    const { container, onChange, unmount } = setup({ minTime: '00:00', maxTime: '00:00' });
    const now = button(container, 'Now');
    const d = new Date();
    const atMidnight = d.getHours() === 0 && d.getMinutes() === 0;
    expect(now.disabled).toBe(!atMidnight);
    act(() => now.click());
    if (!atMidnight) {
      expect(onChange).not.toHaveBeenCalled();
    }
    unmount();
  });
});
