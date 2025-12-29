import FieldRenderer from './FieldRenderer';
import FieldToolbar from './FieldToolbar';
import classNames from 'classnames';

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
      className={classNames('sf-p-5 sf-cursor-pointer sf-transition-all sf-relative', {
        'sf-bg-blue-50 sf-border-2 sf-border-blue-600': isSelected,
        'sf-bg-gray-50 sf-border sf-border-gray-300': isHovered && !isSelected,
        'sf-bg-white sf-border sf-border-gray-300': !isSelected && !isHovered,
      })}
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
