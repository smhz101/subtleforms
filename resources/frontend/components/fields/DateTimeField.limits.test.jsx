/**
 * 2.9.0: the minute step, the earliest and latest time, disabled weekdays,
 * "No past dates" and the default day or time of the Date, Time and
 * Date & time fields.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DateTimeField from './DateTimeField';
import { toIsoDate } from '../../../shared/dateTime';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.useRealTimers();
});

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = jest.fn();
  act(() => root.render(<DateTimeField inputId='f1' name='f' value='' onChange={onChange} {...props} />));
  return { container, onChange, unmount: () => act(() => root.unmount()) };
}

const open = (container) => act(() => container.querySelector('.subtleforms-picker__open').click());
const labels = (container, name) => [...container.querySelectorAll(`[role="listbox"][aria-label="${name}"] [role="option"]`)];

describe('minute step', () => {
  test.each([[5, 12], [15, 4], [30, 2], [60, 1]])('step %i lists %i minutes', (step, count) => {
    const { container, unmount } = mount({ mode: 'time', minuteStep: step, value: '09:00' });
    open(container);
    expect(labels(container, 'Minute')).toHaveLength(count);
    unmount();
  });

  test('the default step is 15', () => {
    const { container, unmount } = mount({ mode: 'time', value: '09:00' });
    open(container);
    expect(labels(container, 'Minute').map((o) => o.textContent)).toEqual(['00', '15', '30', '45']);
    unmount();
  });
});

describe('minTime and maxTime', () => {
  test('hours and minutes outside the range are disabled and cannot be picked', () => {
    const { container, onChange, unmount } = mount({ mode: 'time', minTime: '09:00', maxTime: '17:30', value: '09:00', minuteStep: 30 });
    open(container);
    const hours = labels(container, 'Hour');
    expect(hours[8].getAttribute('aria-disabled')).toBe('true');
    expect(hours[9].getAttribute('aria-disabled')).toBeNull();
    expect(hours[17].getAttribute('aria-disabled')).toBeNull();
    expect(hours[18].getAttribute('aria-disabled')).toBe('true');
    act(() => hours[8].click());
    expect(onChange).not.toHaveBeenCalled();
    act(() => hours[17].click());
    expect(onChange).toHaveBeenLastCalledWith('17:00');
    unmount();
  });

  test('the minutes of the last hour follow maxTime', () => {
    const { container, unmount } = mount({ mode: 'time', maxTime: '17:30', value: '17:00', minuteStep: 15 });
    open(container);
    const minutes = labels(container, 'Minute');
    expect(minutes.map((o) => o.getAttribute('aria-disabled'))).toEqual([null, null, null, 'true']);
    unmount();
  });
});

describe('disabled days', () => {
  const day = (container, text) => [...container.querySelectorAll('[role="gridcell"]')]
    .find((cell) => cell.textContent === text && !cell.classList.contains('is-outside'));

  test('disabled weekdays are not pickable', () => {
    // 2025-03-02 is a Sunday.
    const { container, onChange, unmount } = mount({ mode: 'date', value: '2025-03-10', disabledWeekdays: [0, 6] });
    open(container);
    expect(day(container, '2').getAttribute('aria-disabled')).toBe('true');
    expect(day(container, '3').getAttribute('aria-disabled')).toBeNull();
    act(() => day(container, '2').click());
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  test('"No past dates" disables the days before today', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 2, 15, 10, 0));
    const { container, unmount } = mount({ mode: 'date', value: '', disablePast: true });
    open(container);
    expect(day(container, '14').getAttribute('aria-disabled')).toBe('true');
    expect(day(container, '15').getAttribute('aria-disabled')).toBeNull();
    unmount();
  });

  test('a relative minimum is resolved against today', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 2, 15, 10, 0));
    const { container, unmount } = mount({ mode: 'date', value: '', min: 'today' });
    open(container);
    expect(day(container, '14').getAttribute('aria-disabled')).toBe('true');
    expect(day(container, '15').getAttribute('aria-disabled')).toBeNull();
    unmount();
  });
});

describe('default today and now', () => {
  test('today fills an empty date field once', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 2, 15, 10, 7));
    const { onChange, unmount } = mount({ mode: 'date', defaultMode: 'today' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(toIsoDate(new Date(2025, 2, 15)));
    unmount();
  });

  test('now fills an empty time field, rounded up to the step', () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 2, 15, 10, 7));
    const { onChange, unmount } = mount({ mode: 'time', defaultMode: 'now', minuteStep: 15 });
    expect(onChange).toHaveBeenCalledWith('10:15');
    unmount();
  });

  test('a value that is already there is kept', () => {
    const { onChange, unmount } = mount({ mode: 'date', defaultMode: 'today', value: '2024-01-02' });
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  test('none leaves the field empty', () => {
    const { onChange, unmount } = mount({ mode: 'date', defaultMode: 'none' });
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });
});
