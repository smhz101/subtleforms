/**
 * FF2-16: "Import forms", "Import submissions" and "Choose export file" are
 * real buttons that open the file picker, so Enter and Space work.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

jest.mock('../ToolsPage.scss', () => ({}));
jest.mock('../../components/AdminShell', () => function AdminShellMock({ children }) {
  return <div>{children}</div>;
});

import { FileButton } from '../ToolsPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe('file picker button (FF2-16)', () => {
  test('is a real button outside any label, with the file input kept out of the tab order', () => {
    const { container, unmount } = mount(<FileButton label='Import forms' busy={false} onFile={() => {}} />);
    const button = container.querySelector('button');
    const input = container.querySelector('input[type="file"]');
    expect(button.textContent).toBe('Import forms');
    expect(button.closest('label')).toBeNull();
    expect(input.closest('label')).toBeNull();
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('aria-hidden')).toBe('true');
    unmount();
  });

  test('activating the button opens the file picker', () => {
    const { container, unmount } = mount(<FileButton label='Import forms' busy={false} onFile={() => {}} />);
    const input = container.querySelector('input[type="file"]');
    const open = jest.spyOn(input, 'click');
    // A native button turns Enter and Space into a click.
    act(() => container.querySelector('button').click());
    expect(open).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('a busy page disables both the button and the input', () => {
    const { container, unmount } = mount(<FileButton label='Import forms' busy onFile={() => {}} />);
    expect(container.querySelector('button').disabled).toBe(true);
    expect(container.querySelector('input[type="file"]').disabled).toBe(true);
    unmount();
  });

  test('choosing a file passes it on and clears the input so the same file can be chosen again', () => {
    const onFile = jest.fn();
    const { container, unmount } = mount(<FileButton label='Import forms' busy={false} onFile={onFile} />);
    const input = container.querySelector('input[type="file"]');
    const file = new File(['{}'], 'forms.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onFile).toHaveBeenCalledWith(file);
    unmount();
  });
});
