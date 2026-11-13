/**
 * 2.9.0: the Date, Time and Date & time inspector controls: the date limit
 * (a date or a relative expression), the time limit, the weekday chips and
 * the custom format that only shows for the Custom preset.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DynamicInspectorPanel from '../DynamicInspectorPanel';
import { ConfigContext } from '../../context/ConfigContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

const definition = {
  inspectorControls: [
    { type: 'select', name: 'format', label: 'Date format', section: 'general', options: [{ value: 'site', label: 'Site' }, { value: 'custom', label: 'Custom' }] },
    { type: 'text', name: 'customFormat', label: 'Custom format', section: 'general', showWhen: { format: ['custom'] } },
    { type: 'date', name: 'minDate', label: 'Earliest date', section: 'general' },
    { type: 'time', name: 'minTime', label: 'Earliest time', section: 'general' },
    { type: 'weekdays', name: 'disabledWeekdays', label: 'Unavailable weekdays', section: 'general' },
  ],
};

function mount(field, onUpdate = () => {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ConfigContext.Provider value={{ fieldDefinitions: { date: definition } }}>
        <DynamicInspectorPanel field={field} onUpdate={onUpdate} sections={['general']} />
      </ConfigContext.Provider>
    )
  );
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('date, time and weekday controls', () => {
  it('shows the custom format only for the Custom preset', () => {
    expect(mount({ type: 'date', id: 'a', format: 'site' }).textContent).not.toContain('Custom format');
    document.body.innerHTML = '';
    expect(mount({ type: 'date', id: 'a', format: 'custom' }).textContent).toContain('Custom format');
  });

  it('draws a calendar date as a date input and offers a relative date', () => {
    const update = jest.fn();
    const c = mount({ type: 'date', id: 'a', minDate: '2025-03-31' }, update);
    expect(c.querySelector('input[type="date"]').value).toBe('2025-03-31');
    const link = [...c.querySelectorAll('button')].find((b) => b.textContent === 'Use a relative date');
    act(() => link.click());
    expect(update).toHaveBeenCalledWith({ minDate: 'today' });
  });

  it('draws a relative expression as text and offers to pick a date', () => {
    const update = jest.fn();
    const c = mount({ type: 'date', id: 'a', minDate: '+7 days' }, update);
    expect(c.querySelector('input[type="date"]')).toBeNull();
    expect(c.querySelector('input[type="text"][value="+7 days"]')).not.toBeNull();
    const link = [...c.querySelectorAll('button')].find((b) => b.textContent === 'Pick a date');
    act(() => link.click());
    expect(update.mock.calls[0][0].minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('stores a time as H:i', () => {
    const update = jest.fn();
    const c = mount({ type: 'date', id: 'a', minTime: '09:00' }, update);
    const input = c.querySelector('input[type="time"]');
    expect(input.value).toBe('09:00');
  });

  it('has seven weekday chips that add and remove day numbers', () => {
    const update = jest.fn();
    const c = mount({ type: 'date', id: 'a', disabledWeekdays: [0] }, update);
    const chips = c.querySelectorAll('input[type="checkbox"]');
    expect(chips).toHaveLength(7);
    expect(chips[0].checked).toBe(true);
    act(() => chips[6].click());
    expect(update).toHaveBeenCalledWith({ disabledWeekdays: [0, 6] });
    act(() => chips[0].click());
    expect(update).toHaveBeenLastCalledWith({ disabledWeekdays: [] });
  });
});
