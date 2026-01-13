import FieldRenderer from './FieldRenderer';
import FieldToolbar from './FieldToolbar';
import clsx from 'clsx';
import './FieldWrapper.scss';

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
      className={clsx('field-wrapper', {
        'field-wrapper--selected': isSelected,
        'field-wrapper--hovered': isHovered && !isSelected,
        'field-wrapper--default': !isSelected && !isHovered,
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
