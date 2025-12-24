import { useState } from '@wordpress/element';
import FieldToolbar from './FieldToolbar';

export default function FieldChrome({
  children,
  isSelected,
  onSelect,
  dragHandleRef,
  dragHandleListeners,
  toolbarActions,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showToolbar = isSelected || isHovered;
  const chromeClasses = ['subtleforms-field-chrome'];

  if (isSelected) {
    chromeClasses.push('is-selected');
  }

  if (isHovered) {
    chromeClasses.push('is-hovered');
  }

  return (
    <div
      className={chromeClasses.join(' ')}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <div className='p-5 subtleforms-field-chrome__inner'>{children}</div>
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
