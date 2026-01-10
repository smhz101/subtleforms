import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import FieldToolbar from './FieldToolbar';

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
  const chromeClasses = ['subtleforms-field-chrome'];

  const hasValidationMessages =
    Array.isArray(validationMessages) && validationMessages.length > 0;

  if (isSelected) {
    chromeClasses.push('is-selected');
  }

  if (isHovered) {
    chromeClasses.push('is-hovered');
  }

  if (hasValidationMessages) {
    chromeClasses.push('sf-border-l-4', 'sf-border-red-500');
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      className={chromeClasses.join(' ')}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      tabIndex='0'
      role='group'
      aria-label={__('Field group. Press Enter to select.', 'subtleforms')}>
      <div className='sf-p-5 subtleforms-field-chrome__inner'>
        {hasValidationMessages && (isSelected || isHovered) && (
          <div className='sf-mb-2 sf-text-red-600 sf-text-xs'>
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
