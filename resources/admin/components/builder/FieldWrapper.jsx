import FieldRenderer from './FieldRenderer';
import FieldToolbar from './FieldToolbar';

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
      className={`p-5 cursor-pointer transition-all relative ${
        isSelected
          ? 'bg-blue-50 border-2 border-blue-600'
          : isHovered
          ? 'bg-gray-50 border border-gray-300'
          : 'bg-white border border-gray-300'
      }`}
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
