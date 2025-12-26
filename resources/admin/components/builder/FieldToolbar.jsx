import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

export default function FieldToolbar({
  visible,
  dragHandleRef,
  dragHandleListeners,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  canMoveUp,
  canMoveDown,
}) {
  const { onPointerDown, onMouseDown, onTouchStart, ...handleRest } =
    dragHandleListeners || {};

  const handlePointerDown = (event) => {
    event.stopPropagation();
    if (typeof onPointerDown === 'function') {
      onPointerDown(event);
    }
  };

  const handleMouseDown = (event) => {
    event.stopPropagation();
    if (typeof onMouseDown === 'function') {
      onMouseDown(event);
    }
  };

  const handleTouchStart = (event) => {
    event.stopPropagation();
    if (typeof onTouchStart === 'function') {
      onTouchStart(event);
    }
  };

  const createHandler = (callback) => (event) => {
    event.stopPropagation();
    if (typeof callback === 'function') {
      callback();
    }
  };

  const renderButton = (iconName, label, handler, disabled) => {
    const IconComponent = getIcon(iconName);
    return (
      <button
        type='button'
        onClick={createHandler(handler)}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className={`
          w-7 h-7 flex items-center justify-center
          border border-transparent bg-transparent
          transition-colors duration-150
          ${
            disabled
              ? 'text-text-tertiary cursor-default'
              : 'text-text-primary cursor-pointer hover:bg-surface-alt hover:text-primary'
          }
        `}
        aria-label={label}
        disabled={disabled}>
        <IconComponent size={16} />
      </button>
    );
  };

  return (
    <div
      className={`
        absolute top-0 right-0 -mt-3 mr-2
        flex gap-1 p-1
        bg-white border border-border
        transition-opacity duration-150
        z-20
        ${
          visible
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }
      `}
      aria-hidden={!visible}>
      <button
        type='button'
        ref={dragHandleRef}
        {...handleRest}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={(event) => event.stopPropagation()}
        className='flex justify-center items-center bg-transparent hover:bg-secondary border border-transparent w-7 h-7 text-text-primary hover:text-primary-hover transition-colors transition-colors duration-150 duration-150 cursor-grab active:cursor-grabbing'
        aria-label={__('Drag field', 'subtleforms')}>
        {(() => {
          const DragIcon = getIcon('move');
          return <DragIcon size={16} />;
        })()}
      </button>
      {renderButton(
        'arrow-up-alt2',
        __('Move field up', 'subtleforms'),
        canMoveUp ? onMoveUp : null,
        !canMoveUp
      )}
      {renderButton(
        'arrow-down-alt2',
        __('Move field down', 'subtleforms'),
        canMoveDown ? onMoveDown : null,
        !canMoveDown
      )}
      {renderButton(
        'admin-page',
        __('Duplicate field', 'subtleforms'),
        onDuplicate,
        false
      )}
      {renderButton(
        'trash',
        __('Delete field', 'subtleforms'),
        onDelete,
        false
      )}
    </div>
  );
}
