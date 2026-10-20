/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import BuilderViewSwitcher from './BuilderViewSwitcher';

describe('BuilderViewSwitcher', () => {
  it('labels the form settings view Form, not Settings', () => {
    render(<BuilderViewSwitcher value="build" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /form/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^settings$/i })).not.toBeInTheDocument();
  });
});
