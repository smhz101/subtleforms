/**
 * Page Break description under the step title (FA-21).
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import StepNavigation, { stepText } from './StepNavigation';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('FA-21: step description', () => {
  it('reads title and description from a flat step', () => {
    expect(stepText({ type: 'step', title: 'About you', description: 'Step one help' }, 0)).toEqual({
      title: 'About you',
      description: 'Step one help',
    });
  });

  it('reads them from config and falls back to a numbered title', () => {
    expect(stepText({ config: { description: 'Help' } }, 1)).toEqual({ title: 'Step 2', description: 'Help' });
  });

  it('shows the description under the step title', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(
        <StepNavigation
          steps={[{ type: 'step', id: 's1', title: 'One', description: 'Step one help' }, { type: 'step', id: 's2' }]}
          currentStepIndex={0}
          onStepClick={() => {}}
        />
      );
    });
    expect(container.querySelector('.sf-step-description').textContent).toBe('Step one help');
    act(() => root.unmount());
  });
});
