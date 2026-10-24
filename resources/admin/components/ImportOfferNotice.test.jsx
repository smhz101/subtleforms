/**
 * Dismissible notice after the import offer modal is closed (2.7.2).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ImportOfferNotice, { joinLabels } from './ImportOfferNotice';

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
  act(() => root.render(<ImportOfferNotice />));
  return { container, unmount: () => act(() => root.unmount()) };
}

const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);

describe('joinLabels', () => {
  test('joins one, two and many names', () => {
    expect(joinLabels(['A'])).toBe('A');
    expect(joinLabels(['A', 'B'])).toBe('A and B');
    expect(joinLabels(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('ImportOfferNotice', () => {
  beforeEach(() => {
    mockMutate.dismiss.mockReset();
    mockNavigate.mockReset();
  });

  test('shows nothing when there is nothing to offer', () => {
    mockOffer.mockReturnValue({ data: { offer: null } });
    const { container, unmount } = mount();
    expect(container.innerHTML).toBe('');
    unmount();
  });

  test('lists plugin names and can be dismissed', () => {
    mockOffer.mockReturnValue({
      data: { offer: 'notice', labels: ['Contact Form 7', 'WPForms'] },
    });
    const { container, unmount } = mount();
    expect(container.textContent).toContain('You can import forms from Contact Form 7 and WPForms.');
    act(() => button(container, 'Dismiss').click());
    expect(mockMutate.dismiss).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('Import forms dismisses then opens Tools Migrate', () => {
    mockMutate.dismiss.mockImplementation((_vars, opts) => {
      if (opts && typeof opts.onSettled === 'function') {
        opts.onSettled();
      }
    });
    mockOffer.mockReturnValue({
      data: { offer: 'notice', labels: ['Contact Form 7'] },
    });
    const replaceSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const { container, unmount } = mount();
    act(() => button(container, 'Import forms').click());
    expect(mockMutate.dismiss).toHaveBeenCalledTimes(1);
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '#tab=tools&section=migrate');
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    replaceSpy.mockRestore();
    unmount();
  });
});
