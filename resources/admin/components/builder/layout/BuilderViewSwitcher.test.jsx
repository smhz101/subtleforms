/**
 * The builder view tabs keep an accessible name and a tooltip when their text
 * is hidden on narrow screens, and the selected tab points at its panel (#138).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import BuilderViewSwitcher from './BuilderViewSwitcher';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(value) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<BuilderViewSwitcher value={value} onChange={() => {}} />));
  return { el, root };
}

test('every view tab has its label as name and tooltip', () => {
  const { el, root } = render('build');
  const tabs = [...el.querySelectorAll('[role="tab"]')];
  expect(tabs.map((t) => t.getAttribute('aria-label'))).toEqual(['Build', 'Settings', 'Entries', 'Preview']);
  expect(tabs.map((t) => t.getAttribute('title'))).toEqual(['Build', 'Settings', 'Entries', 'Preview']);
  act(() => root.unmount());
});

test('only the selected tab controls a panel', () => {
  const { el, root } = render('settings');
  const tabs = [...el.querySelectorAll('[role="tab"]')];
  expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual([null, 'sf-builder-panel-settings', null, null]);
  act(() => root.unmount());
});
