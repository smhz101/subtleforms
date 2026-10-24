/**
 * Fresh-install import offer modal (2.7.2).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ImportOfferModal from './ImportOfferModal';

const mockOffer = jest.fn();
const mockMutate = { defer: jest.fn(), dismiss: jest.fn() };
const mockNavigate = jest.fn();

jest.mock('../data', () => ({
  useImportOffer: () => mockOffer(),
  useImportOfferAction: (action) => ({ mutate: mockMutate[action], isPending: false }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<ImportOfferModal />));
  return { container, unmount: () => act(() => root.unmount()) };
}

const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);

describe('ImportOfferModal', () => {
  beforeEach(() => {
    Object.values(mockMutate).forEach((fn) => fn.mockReset());
    mockNavigate.mockReset();
  });

  test('shows nothing when offer is not modal', () => {
    mockOffer.mockReturnValue({ data: { offer: 'notice' } });
    const { container, unmount } = mount();
    expect(container.innerHTML).toBe('');
    unmount();
  });

  test('lists sources and defers on Not now', () => {
    mockOffer.mockReturnValue({
      data: {
        offer: 'modal',
        sources: [
          { id: 'cf7', label: 'Contact Form 7', count: 2, can_import: true },
          { id: 'wpforms', label: 'WPForms', count: 1, can_import: false },
        ],
      },
    });
    const { container, unmount } = mount();
    // Modal portals to document.body
    const dialog = document.querySelector('[role="dialog"]') || container;
    expect(dialog.textContent).toContain('Contact Form 7');
    expect(dialog.textContent).toContain('2 forms');
    expect(dialog.textContent).toContain('WPForms');
    act(() => button(dialog, 'Not now').click());
    expect(mockMutate.defer).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('Import forms dismisses then navigates to Settings Tools Migrate', () => {
    mockMutate.dismiss.mockImplementation((_vars, opts) => {
      if (opts && typeof opts.onSettled === 'function') {
        opts.onSettled();
      }
    });
    mockOffer.mockReturnValue({
      data: {
        offer: 'modal',
        sources: [{ id: 'cf7', label: 'Contact Form 7', count: 1, can_import: true }],
      },
    });
    const replaceSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const { unmount } = mount();
    const dialog = document.querySelector('[role="dialog"]') || document.body;
    act(() => button(dialog, 'Import forms').click());
    expect(mockMutate.dismiss).toHaveBeenCalledTimes(1);
    expect(mockMutate.defer).not.toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '#tab=tools&section=migrate');
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    replaceSpy.mockRestore();
    unmount();
  });
});
