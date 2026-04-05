/**
 * StepCanvas Component
 *
 * Dedicated canvas for rendering a single step's contents in multi-step forms.
 * Provides step-scoped drag & drop, insert zones, and empty states.
 */
import { useState, useCallback, useRef } from '@wordpress/element';
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
    actions: { onDelete, onDuplicate, onMove, onRequestInsert, onUpdate },
    validationErrors,
    isReadOnly,
  } = useBuilder();

  // Inline editing state: 'title' | 'description' | null
  const [editingField, setEditingField] = useState(null);
  const titleInputRef = useRef(null);
  const descInputRef = useRef(null);

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

  const startEditing = useCallback(
    (field, e) => {
      if (isReadOnly) return;
      e.stopPropagation();
      setSelectedId(stepId);
      setEditingField(field);
    },
    [isReadOnly, stepId, setSelectedId]
  );

  const commitEdit = useCallback(
    (field, value) => {
      if (!isReadOnly) {
        onUpdate(stepId, { [field]: value });
      }
      setEditingField(null);
    },
    [isReadOnly, stepId, onUpdate]
  );

  const handleKeyDown = useCallback(
    (field, value, e) => {
      if (e.key === 'Enter' && field === 'title') {
        e.preventDefault();
        commitEdit(field, value);
      }
      if (e.key === 'Escape') {
        setEditingField(null);
      }
    },
    [commitEdit]
  );

  if (!stepNode) {
    return (
      <div className='sf-step-canvas__not-found'>
        {__('Step not found', 'subtleforms')}
      </div>
    );
  }

  const children = stepNode.children || [];
  const stepTitle =
    stepNode.config?.title || '';
  const stepDescription = stepNode.config?.description || '';

  // Render step canvas
  return (
    <div
      className='subtleforms-step-canvas'
      data-testid={`step-canvas-${stepNumber}`}>
      {/* Step Context Header */}
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
            {/* Inline-editable title */}
            {editingField === 'title' ? (
              <input
                ref={titleInputRef}
                className='sf-step-header__title-input'
                defaultValue={stepTitle}
                autoFocus
                onBlur={(e) => commitEdit('title', e.target.value)}
                onKeyDown={(e) => handleKeyDown('title', e.target.value, e)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className={`sf-step-header__title${!isReadOnly ? ' sf-step-header__title--editable' : ''}`}
                onClick={(e) => startEditing('title', e)}
                title={!isReadOnly ? __('Click to edit step title', 'subtleforms') : undefined}>
                {stepTitle || __('Untitled Step', 'subtleforms')}
              </div>
            )}
            {/* Inline-editable description */}
            {editingField === 'description' ? (
              <textarea
                ref={descInputRef}
                className='sf-step-header__desc-input'
                defaultValue={stepDescription}
                autoFocus
                rows={2}
                onBlur={(e) => commitEdit('description', e.target.value)}
                onKeyDown={(e) => handleKeyDown('description', e.target.value, e)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className={`sf-step-header__description${!isReadOnly ? ' sf-step-header__description--editable' : ''}`}
                onClick={(e) => startEditing('description', e)}
                title={!isReadOnly ? __('Click to edit step description', 'subtleforms') : undefined}>
                {stepDescription || (
                  !isReadOnly && (
                    <span className='sf-step-header__description-placeholder'>
                      {__('Add a description…', 'subtleforms')}
                    </span>
                  )
                )}
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
