import { memo, useMemo } from '@wordpress/element';
import FieldRenderer from './FieldRenderer';
import FieldToolbar from './FieldToolbar';
import clsx from 'clsx';
import './FieldWrapper.scss';

/**
 * FieldWrapper - Memoized field container
 * 
 * Wrapped in memo() to prevent re-renders when unrelated fields change.
 * Only re-renders when its own props change.
 */
const FieldWrapper = memo(function FieldWrapper({
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
  const configWarning = useMemo(() => {
    if (!field) return null;
    if (field.required && !field.label?.trim()) return 'No label set';
    const OPTION_TYPES = ['dropdown', 'radio', 'multiple_choice'];
    if (OPTION_TYPES.includes(field.type) && (!field.options || field.options.length === 0)) {
      return 'No options configured';
    }
    return null;
  }, [field]);

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
      {configWarning && (
        <span className='sf-field-wrapper__config-warning' title={configWarning}>
          ⚠ {configWarning}
        </span>
      )}
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
});

export default FieldWrapper;
