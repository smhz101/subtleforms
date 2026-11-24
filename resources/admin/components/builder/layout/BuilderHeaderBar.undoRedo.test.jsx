/**
 * The header Undo and Redo buttons work while a draft autosave is in flight,
 * like the keyboard shortcuts, and wait only for a manual save (#146).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { BuilderActions } from './BuilderHeaderBar';

jest.mock('./BuilderHeaderBar.scss', () => ({}), { virtual: true });

global.IS_REACT_ACT_ENVIRONMENT = true;

function buttons(props) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<BuilderActions canUndo canRedo dispatch={() => {}} {...props} />));
  const find = (label) => [...el.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith(label));
  const off = (b) => b.disabled || b.getAttribute('aria-disabled') === 'true';
  const out = { undo: off(find('Undo')), redo: off(find('Redo')) };
  return { ...out, done: () => act(() => root.unmount()) };
}

test('undo and redo stay enabled during an autosave', () => {
  const b = buttons({ autoSaving: true, saving: false });
  expect(b.undo).toBe(false);
  expect(b.redo).toBe(false);
  b.done();
});

test('undo and redo wait for a manual save', () => {
  const b = buttons({ autoSaving: false, saving: true });
  expect(b.undo).toBe(true);
  expect(b.redo).toBe(true);
  b.done();
});
