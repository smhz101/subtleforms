/**
 * "+ Rule" in the Logic header adds a rule on an admin that is translated:
 * the editor's add button is found by a stable attribute, not by its English
 * label.
 */
import { act } from 'react';
import { mountInspector } from '../testing/inspectorHarness';

jest.mock('@wordpress/i18n', () => {
  const actual = jest.requireActual('@wordpress/i18n');
  return { ...actual, __: (text) => [...text].reverse().join('') };
});

test('+ Rule adds a rule when every label is translated', () => {
  const h = mountInspector('text', { allFields: [{ key: 'other', label: 'Other', type: 'text' }] });
  const logic = h.container.querySelector('[data-section="logic"]');
  const action = logic.querySelector('.sf-isec__action');
  expect(action.textContent).toBe('eluR +');
  // Nothing on the page still reads "Add rule".
  expect(logic.textContent).not.toMatch(/add rule/i);
  act(() => action.click());
  const call = h.builder.actions.onUpdate.mock.calls.at(-1);
  expect(call[1].logic.groups[0].rules).toEqual([{ field: '', operator: 'equals', value: '' }]);
  h.unmount();
});
