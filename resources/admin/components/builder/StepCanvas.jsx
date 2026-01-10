/**
 * StepCanvas Component
 *
 * Dedicated canvas for rendering a single step's contents in multi-step forms.
 * Provides step-scoped drag & drop, insert zones, and empty states.
 */
import { __ } from '@wordpress/i18n';
import { useBuilder } from './context/BuilderContext';
import ColumnDropZone from './ColumnDropZone';

export default function StepCanvas({
  stepId,
  stepNumber,
  totalSteps,
  renderNode,
}) {
  // Get state from context
  const {
    tree,
    selectedId,
    setSelectedId,
    actions: { onDelete, onDuplicate, onMove, onRequestInsert },
    validationErrors,
  } = useBuilder();

  // Build validation errors map
  const validationErrorsByFieldKey = {};
  if (Array.isArray(validationErrors)) {
    validationErrors.forEach((err) => {
      const fieldKey = err?.fieldKey || err?.field_key || null;
      const message = err?.message || null;
      if (fieldKey && message) {
        if (!validationErrorsByFieldKey[fieldKey]) {
          validationErrorsByFieldKey[fieldKey] = [];
        }
        validationErrorsByFieldKey[fieldKey].push(message);
      }
    });
  }

  const stepNode = tree.nodes[stepId];

  if (!stepNode) {
    return (
      <div className='sf-py-12 sf-text-gray-500 sf-text-center'>
        {__('Step not found', 'subtleforms')}
      </div>
    );
  }

  const children = stepNode.children || [];
  const stepTitle =
    stepNode.config?.title || __('Untitled Step', 'subtleforms');
  const stepDescription = stepNode.config?.description || '';

  // DEBUG: Log step rendering
  console.log('[SubtleForms] StepCanvas render:', {
    stepId: stepId,
    stepTitle: stepTitle,
    stepNumber: stepNumber,
    childrenCount: children.length,
    childrenIds: children,
    stepNodeType: stepNode.type,
  });

  return (
    <div
      className='subtleforms-step-canvas'
      data-testid={`step-canvas-${stepNumber}`}>
      {/* Step Context Header - Clickable to select step */}
      <div
        className='sf-bg-blue-50 hover:sf-bg-blue-100 sf-mb-6 sf-px-4 sf-py-3 sf-border sf-border-blue-200 sf-rounded-lg sf-cursor-pointer'
        onClick={() => setSelectedId(stepId)}
        role='button'
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedId(stepId);
          }
        }}
        data-testid={`step-header-${stepNumber}`}>
        <div className='sf-flex sf-items-center sf-gap-3'>
          <div className='sf-flex sf-flex-shrink-0 sf-justify-center sf-items-center sf-bg-blue-600 sf-rounded-full sf-w-8 sf-h-8 sf-font-semibold sf-text-white sf-text-sm'>
            {stepNumber}
          </div>
          <div className='sf-flex-1'>
            <div className='sf-font-semibold sf-text-gray-900 sf-text-sm'>
              {stepTitle}
            </div>
            {stepDescription && (
              <div className='sf-mt-1 sf-text-gray-600 sf-text-xs'>
                {stepDescription}
              </div>
            )}
          </div>
          <div className='sf-text-gray-500 sf-text-xs'>
            {__('Editing Step', 'subtleforms')} {stepNumber}{' '}
            {__('of', 'subtleforms')} {totalSteps}
          </div>
        </div>
      </div>

      {/* Step Content Area */}
      <div className='sf-min-h-[300px]'>
        <ColumnDropZone
          containerId={stepId}
          columnIndex={null}
          items={children}
          onRequestInsert={onRequestInsert}
          spacing={24}
          renderItem={(nodeId, index) =>
            renderNode(nodeId, stepId, null, index)
          }
        />
      </div>

      {/* Empty State */}
      {children.length === 0 && (
        <div className='sf-px-4 sf-py-12 sf-text-center'>
          <div className='sf-mb-3 sf-text-gray-400'>
            <svg
              className='sf-mx-auto sf-w-16 sf-h-16'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
          </div>
          <p className='sf-mb-2 sf-font-medium sf-text-gray-600'>
            {__('This step is empty', 'subtleforms')}
          </p>
          <p className='sf-text-gray-500 sf-text-sm'>
            {__(
              'Drag fields from the left panel to add them to this step',
              'subtleforms'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
