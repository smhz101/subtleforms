import FieldRenderer from './FieldRenderer';
import FieldToolbar from './FieldToolbar';
import clsx from 'clsx';

export default function FieldWrapper({
  field,
  index,
  isHovered,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onHover,
  onLeave,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}) {
  return (
    <div
      className={clsx(
        'sf-relative sf-p-5 sf-transition-all sf-cursor-pointer',
        {
          'sf-bg-blue-50 sf-border-2 sf-border-blue-600': isSelected,
          'sf-bg-gray-50 sf-border sf-border-gray-300':
            isHovered && !isSelected,
          'sf-bg-white sf-border sf-border-gray-300': !isSelected && !isHovered,
        }
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}>
      <FieldRenderer field={field} />

      {isSelected && (
        <FieldToolbar
          index={index}
          isFirst={isFirst}
          isLast={isLast}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
