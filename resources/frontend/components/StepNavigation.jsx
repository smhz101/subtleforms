import { __, sprintf } from '@wordpress/i18n';
import { fieldConfig } from '../../shared/fieldConfig';

/**
 * A step's title and description, whether the step was saved flat or with
 * its settings under `config` (FA-21).
 *
 * @param {Object} step  Step node.
 * @param {number} index Position of the step.
 * @return {{title: string, description: string}} Text to show.
 */
export function stepText(step, index) {
  const c = fieldConfig(step);
  return {
    title: c.title || c.label || __('Step', 'subtleforms') + ' ' + (index + 1),
    description: typeof c.description === 'string' ? c.description : '',
  };
}

export default function StepNavigation({
  steps,
  currentStepIndex,
  onStepClick,
}) {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className='subtleforms--multistep'>
      <div className='sf-step-navigation-wrapper subtleforms-step-nav'>
        <nav
          className='sf-step-navigation'
          aria-label={__('Form steps', 'subtleforms')}>
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            const isClickable = index <= currentStepIndex;
            const { title: stepTitle, description: stepDescription } = stepText(step, index);

            return (
              <div
                key={step.key || step.id || index}
                className={`sf-step-item subtleforms-step-nav-item ${
                  isActive ? 'sf-step-active is-active' : ''
                } ${isCompleted ? 'sf-step-completed is-complete' : ''} ${
                  isClickable ? 'sf-step-clickable' : 'sf-step-disabled'
                } ${!isCompleted && !isActive ? 'is-upcoming' : ''}`}>
                <button
                  type='button'
                  className='sf-step-button'
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={
                    isCompleted
                      ? sprintf(
                          /* translators: %s: step title */
                          __('%s (completed)', 'subtleforms'),
                          stepTitle
                        )
                      : isActive
                      ? sprintf(
                          /* translators: %s: step title */
                          __('%s (current)', 'subtleforms'),
                          stepTitle
                        )
                      : stepTitle
                  }>
                  <div className='sf-step-indicator'>
                    {isCompleted ? (
                      <svg
                        aria-hidden='true'
                        focusable='false'
                        className='sf-step-check'
                        viewBox='0 0 20 20'
                        fill='currentColor'>
                        <path
                          fillRule='evenodd'
                          d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                    ) : (
                      <span className='sf-step-number'>{index + 1}</span>
                    )}
                  </div>
                  <div className='sf-step-content'>
                    <span className='sf-step-title'>{stepTitle}</span>
                    {stepDescription && (
                      <span className='sf-step-description'>
                        {stepDescription}
                      </span>
                    )}
                  </div>
                </button>
                {index < steps.length - 1 && (
                  <div className='sf-step-connector' aria-hidden='true' />
                )}
              </div>
            );
          })}
        </nav>{' '}
      </div>{' '}
    </div>
  );
}
