/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import HelpMenu from './HelpMenu';

jest.mock('../utils/branding', () => ({
  getBranding: () => ({ hideCredits: true }),
}));

describe('HelpMenu (UX2-25)', () => {
  it('closes the menu when Start Tour is chosen', () => {
    const onStartTour = jest.fn();
    render(<HelpMenu onStartTour={onStartTour} />);
    fireEvent.click(screen.getByLabelText(/help & tour/i));
    fireEvent.click(screen.getByText(/start tour/i));
    expect(onStartTour).toHaveBeenCalled();
  });
});
