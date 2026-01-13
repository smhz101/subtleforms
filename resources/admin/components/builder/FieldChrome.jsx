import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import FieldToolbar from './FieldToolbar';
import './FieldChrome.scss';

export default function FieldChrome({
  children,
  isSelected,
  onSelect,
  dragHandleRef,
  dragHandleListeners,
  toolbarActions,
  validationMessages = [],
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const showToolbar = isSelected || isHovered || isFocused;

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
      className={clsx('field-chrome', {
        'is-selected': isSelected,
        'is-hovered': isHovered,
        'field-chrome--validation-error': hasValidationMessages,
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
      <div className='field-chrome__inner'>
        {hasValidationMessages && (isSelected || isHovered) && (
          <div className='field-chrome__validation-message'>
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
}
