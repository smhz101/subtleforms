/**
 * The logic editor in the free plugin writes the basic form of logic only.
 * The advanced options are a Pro note with an upgrade link, nothing else, and
 * rules saved by SubtleForms Pro are kept untouched.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import LogicEditor from './LogicEditor';
import { registerLogicEditor } from '../../../shared/extend';

jest.mock('./LogicEditor.scss', () => ({}));
jest.mock('../../ui/ProNotice.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const fields = [{ key: 'name', label: 'Name', type: 'text' }];
const basic = {
  action: 'show',
  groups: [{ match: 'all', rules: [{ field: 'name', operator: 'equals', value: 'A' }] }],
};
const advanced = {
  action: 'show',
  groups: [{ match: 'any', rules: [{ field: 'name', operator: 'starts_with', value: 'A' }] }],
};

function mount(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<LogicEditor logic={basic} availableFields={fields} onChange={() => {}} {...props} />));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('logic editor without SubtleForms Pro', () => {
  beforeEach(() => {
    window.subtleformsAdmin = { proUrl: 'https://example.test/pro' };
  });

  test('offers the basic operators only', () => {
    const { container, unmount } = mount();
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'equals'));
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['equals', 'not_equals', 'contains', 'empty', 'greater_than']));
    ['starts_with', 'ends_with', 'in', 'not_in', 'between', 'before', 'after'].forEach((op) => {
      expect(values).not.toContain(op);
    });
    unmount();
  });

  test('has no match select and no add group button, only a Pro note with an upgrade link', () => {
    const { container, unmount } = mount();
    expect(container.textContent).not.toMatch(/Any of these rules/);
    expect(container.textContent).not.toMatch(/Add “or” group/);
    const note = container.querySelector('.sf-logic-editor__pro');
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/Pro/);
    const link = note.querySelector('a');
    expect(link.getAttribute('href')).toContain('example.test/pro');
    expect(link.getAttribute('href')).toContain('logic.conditional.advanced');
    unmount();
  });

  test('leaves rules it cannot show untouched and says they are ignored', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount({ logic: advanced, onChange });
    expect(container.textContent).toMatch(/ignored/);
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  test('Clear rules is the only way to change rules it cannot show', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount({ logic: advanced, onChange });
    const button = [...container.querySelectorAll('button')].find((b) => /Clear rules/.test(b.textContent));
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith(null);
    unmount();
  });

  test.each(['step', 'action', 'confirmation'])('conditions on a %s are a Pro note, with no editor', (scope) => {
    const { container, unmount } = mount({ scope, logic: null });
    expect(container.querySelector('.sf-pro-notice')).not.toBeNull();
    expect(container.querySelectorAll('select').length).toBe(0);
    unmount();
  });

  test('saved rules on a step are kept and reported as ignored', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount({ scope: 'step', logic: basic, onChange });
    expect(container.textContent).toMatch(/ignored/);
    expect(onChange).not.toHaveBeenCalled();
    unmount();
  });

  test('uses the editor SubtleForms Pro registers', () => {
    registerLogicEditor(() => <p className='pro-editor'>pro</p>);
    const { container, unmount } = mount();
    expect(container.querySelector('.pro-editor')).not.toBeNull();
    unmount();
    registerLogicEditor(null);
  });
});
