import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

export default function StepNavigator({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}) {
  if (!steps || steps.length === 0) {
    return (
      <div className="sf-bg-gray-50 sf-px-6 sf-py-4 sf-border-gray-200 sf-border-b sf-w-full">
        <div className="sf-flex sf-justify-between sf-items-center">
          <div className="sf-text-gray-600 sf-text-sm">
            {__('No steps created yet. Add your first step to get started.', 'subtleforms')}
          </div>
          <Button 
            isPrimary 
            onClick={onAddStep}
            className="sf-text-sm"
          >
            <span className="sf-flex sf-items-center sf-gap-2">
              <svg className="sf-w-4 sf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {__('Add First Step', 'subtleforms')}
            </span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sf-bg-white sf-px-6 sf-py-3 sf-border-gray-200 sf-border-b sf-w-full">
      <div className="sf-flex sf-items-center sf-gap-3 sf-overflow-x-auto">
        <div className="sf-flex sf-flex-shrink-0 sf-items-center sf-gap-2">
          <span className="sf-font-medium sf-text-gray-700 sf-text-sm">
            {__('Steps:', 'subtleforms')}
          </span>
        </div>
        
        <div className="sf-flex sf-flex-nowrap sf-items-center sf-gap-2 sf-min-w-0">
          {steps.map((step, index) => {
            const isSelected = step.id === selectedStepId;
            const stepTitle = step.config?.title || step.title || __('Untitled', 'subtleforms');
            
            return (
              <div
                key={step.id}
                className="sf-flex sf-flex-shrink-0 sf-items-center sf-gap-1"
              >
                <button
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  className={`sf-group sf-relative sf-flex sf-items-center sf-gap-2 sf-px-3 sf-py-2 sf-text-sm sf-font-medium sf-rounded-md sf-border sf-transition-all sf-duration-150 sf-whitespace-nowrap ${
                    isSelected
                      ? 'sf-bg-blue-600 sf-text-white sf-border-blue-600 sf-shadow-sm'
                      : 'sf-bg-white sf-text-gray-700 sf-border-gray-300 hover:sf-bg-gray-50 hover:sf-border-gray-400'
                  }`}
                  title={`${( () => { /* translators: %d: step number */ return sprintf(__('Step %d', 'subtleforms'), index + 1); })()}: ${stepTitle}`}
                >
                  <div className={`sf-flex sf-items-center sf-justify-center sf-w-5 sf-h-5 sf-rounded-full sf-text-xs sf-font-semibold ${
                    isSelected 
                      ? 'sf-bg-blue-500 sf-text-white' 
                      : 'sf-bg-gray-100 sf-text-gray-600 group-hover:sf-bg-gray-200'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="sf-max-w-[120px] sf-truncate">
                    {stepTitle}
                  </span>
                </button>
                
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteStep(step.id)}
                    className="sf-flex sf-justify-center sf-items-center hover:sf-bg-red-50 sf-rounded sf-w-6 sf-h-6 sf-text-red-600 hover:sf-text-red-700 sf-transition-colors sf-duration-150"
                    title={( () => { /* translators: %d: step number */ return sprintf(__('Delete step %d', 'subtleforms'), index + 1); } )()}
                  >
                    <svg className="sf-w-4 sf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="sf-flex-shrink-0">
          <Button
            isSecondary
            onClick={onAddStep}
            className="sf-text-blue-600 hover:sf-text-blue-700 sf-text-sm"
          >
            <span className="sf-flex sf-items-center sf-gap-1">
              <svg className="sf-w-4 sf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {__('Add Step', 'subtleforms')}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
