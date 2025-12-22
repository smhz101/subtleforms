import { __ } from '@wordpress/i18n';

export default function StepNavigation({
  steps,
  currentStepIndex,
  onStepClick,
}) {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className='subtleforms-step-nav'>
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;
        const isClickable = index <= currentStepIndex;

        return (
          <div
            key={step.key || index}
            className={`subtleforms-step-nav-item ${
              isActive ? 'is-active' : ''
            } ${isCompleted ? 'is-completed' : ''} ${
              isClickable ? 'is-clickable' : ''
            }`}
            onClick={() => isClickable && onStepClick(index)}>
            <div className='subtleforms-step-nav-number'>{index + 1}</div>
            <div className='subtleforms-step-nav-label'>
              {step.config?.title ||
                __('Step', 'subtleforms') + ' ' + (index + 1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
