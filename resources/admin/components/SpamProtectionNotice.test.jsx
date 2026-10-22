/**
 * The one-time offer to turn spam protection on for every form (2.6.0):
 * shown only when the server offers it, asks for confirmation, then offers
 * Undo.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import SpamProtectionNotice from './SpamProtectionNotice';

const mockProtection = jest.fn();
const mockMutate = { 'enable-all': jest.fn(), undo: jest.fn(), dismiss: jest.fn() };
jest.mock('../data', () => ({
  useSpamProtection: () => mockProtection(),
  useSpamProtectionAction: (action) => ({ mutate: mockMutate[action], isPending: false }),
}));
jest.mock('../modals/ConfirmModal.scss', () => ({}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SpamProtectionNotice />));
  return { container, unmount: () => act(() => root.unmount()) };
}

const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);

describe('SpamProtectionNotice', () => {
  beforeEach(() => Object.values(mockMutate).forEach((fn) => fn.mockReset()));

  test('shows nothing when there is nothing to offer', () => {
    mockProtection.mockReturnValue({ data: { notice: null } });
    const { container, unmount } = mount();
    expect(container.innerHTML).toBe('');
    unmount();
  });

  test('turns protection on only after confirmation', () => {
    mockProtection.mockReturnValue({ data: { notice: 'invite', forms_off: 4 } });
    const { container, unmount } = mount();
    expect(container.textContent).toContain('4 forms do not use the hidden trap field or the too-fast check.');

    act(() => button(container, 'Turn on for all forms').click());
    expect(mockMutate['enable-all']).not.toHaveBeenCalled();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Nothing else on your forms changes.');
    act(() => button(dialog, 'Turn on for all forms').click());
    expect(mockMutate['enable-all']).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('can be dismissed for good', () => {
    mockProtection.mockReturnValue({ data: { notice: 'invite', forms_off: 1 } });
    const { container, unmount } = mount();
    act(() => button(container, 'No thanks').click());
    expect(mockMutate.dismiss).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('offers Undo after turning it on', () => {
    mockProtection.mockReturnValue({ data: { notice: 'enabled', changed: 3 } });
    const { container, unmount } = mount();
    expect(container.textContent).toContain('Spam protection is now on for 3 forms');
    act(() => button(container, 'Undo').click());
    expect(mockMutate.undo).toHaveBeenCalledTimes(1);
    unmount();
  });
});
