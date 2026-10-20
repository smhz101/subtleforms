/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '@testing-library/react';
import BuilderNarrowScreen from './BuilderNarrowScreen';

describe('BuilderNarrowScreen', () => {
  let listeners;
  beforeEach(() => {
    listeners = [];
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query.includes('900'),
      media: query,
      addEventListener: (_e, fn) => listeners.push(fn),
      removeEventListener: jest.fn(),
      addListener: (fn) => listeners.push(fn),
      removeListener: jest.fn(),
    }));
  });

  it('shows a wider-screen note when the viewport is under 900px', () => {
    render(<BuilderNarrowScreen />);
    expect(
      screen.getByText(/builder needs a wider screen/i)
    ).toBeInTheDocument();
    expect(document.body.classList.contains('folded')).toBe(true);
  });
});
