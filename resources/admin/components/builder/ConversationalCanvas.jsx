import { useState, useMemo, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useBuilder } from './context/BuilderContext';
import Icon from '../ui/Icon';
import FieldRenderer from './FieldRenderer';
import FieldChrome from './FieldChrome';
import { nodeToField, nodeChildren, getRootNodeId } from './utils/schemaTree';

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
      <div className='sf-flex sf-flex-col sf-justify-center sf-items-center sf-bg-white sf-shadow-sm sf-mx-auto sf-p-12 sf-border sf-border-gray-200 sf-rounded-lg sf-w-full sf-max-w-2xl sf-h-full sf-text-center'>
        <div className='sf-mb-4 sf-text-4xl'>💬</div>
        <h3 className='sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-lg'>
          {__('No Questions Yet', 'subtleforms')}
        </h3>
        <p className='sf-mb-6 sf-text-gray-600 sf-text-sm'>
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
    <div className='sf-flex sf-flex-col sf-bg-gray-50 sf-mx-auto sf-w-full sf-max-w-3xl sf-h-full'>
      {/* Progress Bar */}
      <div className='sf-bg-white sf-px-6 sf-py-4 sf-border-gray-200 sf-border-b'>
        <div className='sf-flex sf-justify-between sf-items-center sf-mb-2'>
          <span className='sf-font-medium sf-text-gray-700 sf-text-sm'>
            {__('Question', 'subtleforms')} {currentIndex + 1}{' '}
            {__('of', 'subtleforms')} {totalFields}
          </span>
          <span className='sf-text-gray-500 sf-text-xs'>
            {Math.round(progressPercent)}% {__('Complete', 'subtleforms')}
          </span>
        </div>
        <div className='sf-bg-gray-200 sf-rounded-full sf-w-full sf-h-2 sf-overflow-hidden'>
          <div
            className='sf-bg-blue-600 sf-h-full sf-transition-all sf-duration-300'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className='sf-flex sf-flex-col sf-flex-1 sf-justify-center sf-p-8 sf-overflow-y-auto'>
        <div className='sf-bg-white sf-shadow-md sf-mx-auto sf-p-8 sf-border sf-border-gray-200 sf-rounded-lg sf-w-full'>
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
      <div className='sf-flex sf-justify-between sf-items-center sf-bg-white sf-px-6 sf-py-4 sf-border-gray-200 sf-border-t'>
        <Button
          variant='secondary'
          onClick={handlePrevious}
          disabled={!hasPrevious}
          className='sf-inline-flex sf-items-center'>
          <Icon.Left className='sf-mr-1 sf-w-4 sf-h-4' />
          {__('Previous', 'subtleforms')}
        </Button>

        <div className='sf-flex sf-gap-1.5'>
          {fields.map((f, index) => (
            <button
              key={f.id}
              onClick={() => {
                setCurrentIndex(index);
                setSelectedId(f.id);
              }}
              className={`sf-w-2 sf-h-2 sf-rounded-full sf-transition-all ${
                index === currentIndex
                  ? 'sf-bg-blue-600 sf-w-6'
                  : index < currentIndex
                  ? 'sf-bg-blue-300'
                  : 'sf-bg-gray-300'
              }`}
              title={`${__('Question', 'subtleforms')} ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant='primary'
          onClick={handleNext}
          disabled={!hasNext}
          className='sf-inline-flex sf-items-center'>
          {__('Next', 'subtleforms')}
          <Icon.Right className='sf-ml-1 sf-w-4 sf-h-4' />
        </Button>
      </div>
    </div>
  );
}
