import { useState, useMemo, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useBuilder } from './context/BuilderContext';
import Icon from '../ui/Icon';
import FieldRenderer from './FieldRenderer';
import FieldChrome from './FieldChrome';
import { nodeToField, nodeChildren, getRootNodeId } from './utils/schemaTree';
import './ConversationalCanvas.scss';

/**
 * ConversationalCanvas - Single field at a time view for conversational forms
 *
 * Displays one field at a time with Next/Previous navigation and progress indicator
 */
export default function ConversationalCanvas() {
  // Get all state from context
  const {
    tree,
    selectedId,
    setSelectedId,
    actions: { onDelete, onDuplicate, onRequestInsert },
  } = useBuilder();

  const rootId = getRootNodeId();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get all top-level fields (non-container fields)
  const fields = useMemo(() => {
    const allChildren = nodeChildren(tree, rootId);
    return allChildren
      .map((nodeId) => tree.nodes[nodeId])
      .filter(
        (node) => node && node.type !== 'step' && node.type !== 'section'
      );
  }, [tree, rootId]);

  const currentField = fields[currentIndex];
  const totalFields = fields.length;
  const hasNext = currentIndex < totalFields - 1;
  const hasPrevious = currentIndex > 0;

  // Reset to first field if current index is out of bounds
  useEffect(() => {
    if (currentIndex >= totalFields && totalFields > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, totalFields]);

  // If selected field changes externally, update current index
  useEffect(() => {
    if (selectedId) {
      const index = fields.findIndex((f) => f.id === selectedId);
      if (index >= 0 && index !== currentIndex) {
        setCurrentIndex(index);
      }
    }
  }, [selectedId, fields, currentIndex]);

  const handleNext = () => {
    if (hasNext) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setSelectedId(fields[nextIndex]?.id);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setSelectedId(fields[prevIndex]?.id);
    }
  };

  const handleSelect = (nodeId) => {
    setSelectedId(nodeId);
    const index = fields.findIndex((f) => f.id === nodeId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
  };

  if (totalFields === 0) {
    return (
      <div className='sf-conversational-canvas__empty'>
        <div className='sf-conversational-canvas__empty-icon'>
          <Icon.MessageCircle size={32} />
        </div>
        <h3 className='sf-conversational-canvas__empty-title'>
          {__('No Questions Yet', 'subtleforms')}
        </h3>
        <p className='sf-conversational-canvas__empty-description'>
          {__(
            'Add your first question from the left panel. Each field will be displayed one at a time.',
            'subtleforms'
          )}
        </p>
      </div>
    );
  }

  const field = currentField ? nodeToField(tree, currentField.id) : null;
  const progressPercent =
    totalFields > 0 ? ((currentIndex + 1) / totalFields) * 100 : 0;

  return (
    <div className='sf-conversational-canvas'>
      {/* Progress Bar */}
      <div className='sf-conversational-canvas__progress-header'>
        <div className='sf-conversational-canvas__progress-info'>
          <span className='sf-conversational-canvas__progress-label'>
            {__('Question', 'subtleforms')} {currentIndex + 1}{' '}
            {__('of', 'subtleforms')} {totalFields}
          </span>
          <span className='sf-conversational-canvas__progress-percent'>
            {Math.round(progressPercent)}% {__('Complete', 'subtleforms')}
          </span>
        </div>
        <div className='sf-conversational-canvas__progress-bar'>
          <div
            className='sf-conversational-canvas__progress-fill'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className='sf-conversational-canvas__content'>
        <div className='sf-conversational-canvas__card'>
          {field && (
            <FieldChrome
              field={field}
              isSelected={selectedId === currentField.id}
              onSelect={() => handleSelect(currentField.id)}
              onDelete={() => onDelete(currentField.id)}
              onDuplicate={() => onDuplicate(currentField.id)}
              onRequestInsert={(context) =>
                onRequestInsert(currentField.id, context)
              }>
              <FieldRenderer field={field} />
            </FieldChrome>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className='sf-conversational-canvas__navigation'>
        <Button
          variant='secondary'
          onClick={handlePrevious}
          disabled={!hasPrevious}
          className='sf-conversational-canvas__nav-button'>
          <Icon.Left className='sf-conversational-canvas__nav-icon' />
          {__('Previous', 'subtleforms')}
        </Button>

        <div className='sf-conversational-canvas__dots'>
          {fields.map((f, index) => (
            <button
              key={f.id}
              onClick={() => {
                setCurrentIndex(index);
                setSelectedId(f.id);
              }}
              className={`sf-conversational-canvas__dot ${
                index === currentIndex
                  ? 'sf-conversational-canvas__dot--active'
                  : index < currentIndex
                  ? 'sf-conversational-canvas__dot--completed'
                  : 'sf-conversational-canvas__dot--upcoming'
              }`}
              title={`${__('Question', 'subtleforms')} ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant='primary'
          onClick={handleNext}
          disabled={!hasNext}
          className='sf-conversational-canvas__nav-button'>
          {__('Next', 'subtleforms')}
          <Icon.Right className='sf-conversational-canvas__nav-icon' />
        </Button>
      </div>
    </div>
  );
}
