import { useState, useMemo, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import FieldRenderer from './FieldRenderer';
import FieldChrome from './FieldChrome';
import { nodeToField, nodeChildren } from './utils/schemaTree';

/**
 * ConversationalCanvas - Single field at a time view for conversational forms
 *
 * Displays one field at a time with Next/Previous navigation and progress indicator
 */
export default function ConversationalCanvas({
  tree,
  rootId,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onRequestInsert,
}) {
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
      onSelect(fields[nextIndex]?.id);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      onSelect(fields[prevIndex]?.id);
    }
  };

  const handleSelect = (nodeId) => {
    onSelect(nodeId);
    const index = fields.findIndex((f) => f.id === nodeId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
  };

  if (totalFields === 0) {
    return (
      <div className='flex flex-col justify-center items-center bg-white shadow-sm mx-auto p-12 border border-gray-200 rounded-lg w-full max-w-2xl h-full text-center'>
        <div className='mb-4 text-4xl'>💬</div>
        <h3 className='mb-2 font-semibold text-gray-900 text-lg'>
          {__('No Questions Yet', 'subtleforms')}
        </h3>
        <p className='mb-6 text-gray-600 text-sm'>
          {__(
            'Add fields from the left sidebar to create your conversational form. Each field will be displayed one at a time.',
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
    <div className='flex flex-col bg-gray-50 mx-auto w-full max-w-3xl h-full'>
      {/* Progress Bar */}
      <div className='bg-white px-6 py-4 border-gray-200 border-b'>
        <div className='flex justify-between items-center mb-2'>
          <span className='font-medium text-gray-700 text-sm'>
            {__('Question', 'subtleforms')} {currentIndex + 1}{' '}
            {__('of', 'subtleforms')} {totalFields}
          </span>
          <span className='text-gray-500 text-xs'>
            {Math.round(progressPercent)}% {__('Complete', 'subtleforms')}
          </span>
        </div>
        <div className='bg-gray-200 rounded-full w-full h-2 overflow-hidden'>
          <div
            className='bg-blue-600 h-full transition-all duration-300'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className='flex flex-col flex-1 justify-center p-8 overflow-y-auto'>
        <div className='bg-white shadow-md mx-auto p-8 border border-gray-200 rounded-lg w-full'>
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
      <div className='flex justify-between items-center bg-white px-6 py-4 border-gray-200 border-t'>
        <Button
          variant='secondary'
          onClick={handlePrevious}
          disabled={!hasPrevious}
          className='inline-flex items-center'>
          <FiChevronLeft className='mr-1 w-4 h-4' />
          {__('Previous', 'subtleforms')}
        </Button>

        <div className='flex gap-1.5'>
          {fields.map((f, index) => (
            <button
              key={f.id}
              onClick={() => {
                setCurrentIndex(index);
                onSelect(f.id);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-blue-600 w-6'
                  : index < currentIndex
                  ? 'bg-blue-300'
                  : 'bg-gray-300'
              }`}
              title={`${__('Question', 'subtleforms')} ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant='primary'
          onClick={handleNext}
          disabled={!hasNext}
          className='inline-flex items-center'>
          {__('Next', 'subtleforms')}
          <FiChevronRight className='ml-1 w-4 h-4' />
        </Button>
      </div>
    </div>
  );
}
