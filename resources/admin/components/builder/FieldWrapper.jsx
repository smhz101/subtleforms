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
      className={classNames(
        'p-5 cursor-pointer transition-all relative',
        {
          'bg-blue-50 border-2 border-blue-600': isSelected,
          'bg-gray-50 border border-gray-300': isHovered && !isSelected,
          'bg-white border border-gray-300': !isSelected && !isHovered,
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
