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
  const containerStyle = {
    padding: '20px',
    background: isSelected ? '#f0f7ff' : isHovered ? '#fafafa' : '#fff',
    border: isSelected ? '2px solid #2271b1' : '1px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    position: 'relative',
  };

  return (
    <div
      style={containerStyle}
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
