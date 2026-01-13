import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import './StepNavigator.scss';

export default function StepNavigator({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}) {
  if (!steps || steps.length === 0) {
    return (
      <div className='step-navigator step-navigator--empty'>
        <div className='step-navigator__empty-container'>
          <div className='sf-text-gray-600 sf-text-sm'>
            {__(
              'No steps created yet. Add your first step to get started.',
              'subtleforms'
            )}
          </div>
          <Button isPrimary onClick={onAddStep} className='sf-text-sm'>
            <span className='step-navigator__add-button'>
              <svg
                className='step-navigator__add-icon'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
              {__('Add First Step', 'subtleforms')}
            </span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='step-navigator'>
      <div className='step-navigator__container'>
        <div className='step-navigator__label'>
          <span className='sf-font-medium sf-text-gray-700 sf-text-sm'>
            {__('Steps:', 'subtleforms')}
          </span>
        </div>

        <div className='step-navigator__steps-list'>
          {steps.map((step, index) => {
            const isSelected = step.id === selectedStepId;
            const stepTitle =
              step.config?.title || step.title || __('Untitled', 'subtleforms');

            return (
              <div
                key={step.id}
                className='step-navigator__step-item'>
                <button
                  type='button'
                  onClick={() => onSelectStep(step.id)}
                  className={`step-navigator__step-button ${
                    isSelected
                      ? 'step-navigator__step-button--selected'
                      : 'step-navigator__step-button--default'
                  }`}
                  title={`${(() => {
                    /* translators: %d: step number */ return sprintf(
                      __('Step %d', 'subtleforms'),
                      index + 1
                    );
                  })()}: ${stepTitle}`}>
                  <div
                    className={`step-navigator__step-number ${
                      isSelected
                        ? 'step-navigator__step-number--selected'
                        : 'step-navigator__step-number--default'
                    }`}>
                    {index + 1}
                  </div>
                  <span className='step-navigator__step-title'>
                    {stepTitle}
                  </span>
                </button>

                {steps.length > 1 && (
                  <button
                    type='button'
                    onClick={() => onDeleteStep(step.id)}
                    className='step-navigator__delete-button'
                    title={(() => {
                      /* translators: %d: step number */ return sprintf(
                        __('Delete step %d', 'subtleforms'),
                        index + 1
                      );
                    })()}>
                    <svg
                      className='step-navigator__delete-icon'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className='step-navigator__add-button'>
          <Button
            isSecondary
            onClick={onAddStep}
            className='sf-text-blue-600 hover:sf-text-blue-700 sf-text-sm'>
            <span className='step-navigator__add-button'>
              <svg
                className='step-navigator__add-icon'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
              {__('Add Step', 'subtleforms')}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
