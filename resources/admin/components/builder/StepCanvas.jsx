/**
 * StepCanvas Component
 *
 * Dedicated canvas for rendering a single step's contents in multi-step forms.
 * Provides step-scoped drag & drop, insert zones, and empty states.
 */
import { __ } from '@wordpress/i18n';
import { useBuilder } from './context/BuilderContext';
import ColumnDropZone from './ColumnDropZone';
import './StepCanvas.scss';

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
      <div className='sf-step-canvas__not-found'>
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
        className='sf-step-header'
        onClick={() => setSelectedId(stepId)}
        role='button'
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedId(stepId);
          }
        }}
        data-testid={`step-header-${stepNumber}`}>
        <div className='sf-step-header__container'>
          <div className='sf-step-header__number'>{stepNumber}</div>
          <div className='sf-step-header__content'>
            <div className='sf-step-header__title'>{stepTitle}</div>
            {stepDescription && (
              <div className='sf-step-header__description'>
                {stepDescription}
              </div>
            )}
          </div>
          <div className='sf-step-header__edit-label'>
            {__('Editing Step', 'subtleforms')} {stepNumber}{' '}
            {__('of', 'subtleforms')} {totalSteps}
          </div>
        </div>
      </div>

      {/* Step Content Area */}
      <div className='sf-step-content'>
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
        <div className='sf-step-canvas__empty'>
          <div className='sf-step-canvas__empty-icon'>
            <svg
              className='sf-step-empty-icon'
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
          <p className='sf-step-canvas__empty-title'>
            {__('This step is empty', 'subtleforms')}
          </p>
          <p className='sf-step-canvas__empty-description'>
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
