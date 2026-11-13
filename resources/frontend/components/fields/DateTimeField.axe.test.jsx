/**
 * 2.9.0: the open Date, Time and Date & time popovers have no axe violations
 * that jsdom can detect (names, roles, ARIA structure).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import axe from 'axe-core';
import DateTimeField from './DateTimeField';

global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function violations(mode, value) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <div>
      <label htmlFor='f1'>Field</label>
      <DateTimeField mode={mode} inputId='f1' name='f' value={value} label='Field' onChange={() => {}} />
    </div>
  ));
  act(() => container.querySelector('.subtleforms-picker__open').click());
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  act(() => root.unmount());
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`);
}

describe('open popovers', () => {
  it('date', async () => {
    expect(await violations('date', '2025-03-31')).toEqual([]);
  });
  it('time', async () => {
    expect(await violations('time', '09:30')).toEqual([]);
  });
  it('date and time', async () => {
    expect(await violations('datetime', '2025-03-31T09:30')).toEqual([]);
  });
});
