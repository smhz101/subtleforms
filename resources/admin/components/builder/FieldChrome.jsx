import { useState, memo, useRef, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import FieldToolbar from './FieldToolbar';
import './FieldChrome.scss';

/**
 * FieldChrome - Memoized field container with toolbar
 * 
 * Wrapped in memo() to prevent re-renders when unrelated fields change selection.
 * Only re-renders when its own props change (isSelected, validationMessages, etc.).
 */
const FieldChrome = memo(function FieldChrome({
  children,
  isSelected,
  isMultiSelected = false,
  onSelect,
  dragHandleRef,
  dragHandleListeners,
  toolbarActions,
  validationMessages = [],
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const showToolbar = isSelected || isHovered || isFocused;
  const chromeRef = useRef(null);

  // Scroll newly selected field into view
  useEffect(() => {
    if (isSelected && chromeRef.current) {
      chromeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const hasValidationMessages =
    Array.isArray(validationMessages) && validationMessages.length > 0;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      ref={chromeRef}
      className={clsx('sf-field-chrome', {
        'is-selected': isSelected,
        'is-multi-selected': isMultiSelected && !isSelected,
        'is-hovered': isHovered,
        'sf-field-chrome--validation-error': hasValidationMessages,
      })}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      tabIndex='0'
      role='group'
      aria-label={__('Field group. Press Enter to select.', 'subtleforms')}>
      <div className='sf-field-chrome__inner'>
        {hasValidationMessages && (isSelected || isHovered) && (
          <div className='sf-field-chrome__validation-message'>
            {validationMessages[0]}
          </div>
        )}
        {children}
      </div>
      <FieldToolbar
        visible={showToolbar}
        dragHandleRef={dragHandleRef}
        dragHandleListeners={dragHandleListeners}
        onMoveUp={toolbarActions?.onMoveUp}
        onMoveDown={toolbarActions?.onMoveDown}
        onDuplicate={toolbarActions?.onDuplicate}
        onDelete={toolbarActions?.onDelete}
        canMoveUp={toolbarActions?.canMoveUp}
        canMoveDown={toolbarActions?.canMoveDown}
      />
    </div>
  );
});

export default FieldChrome;
