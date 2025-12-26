import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
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

  const renderButton = (iconName, label, handler, disabled, variant = 'default') => {
    const IconComponent = getIcon(iconName);
    return (
      <button
        type='button'
        onClick={createHandler(handler)}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className={classNames(
          'w-8 h-8 flex items-center justify-center',
          'border border-transparent rounded',
          'transition-all duration-150',
          {
            'text-gray-400 cursor-not-allowed': disabled,
            'text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer': !disabled && variant === 'default',
            'text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer': !disabled && variant === 'danger',
          }
        )}
        aria-label={label}
        title={label}
        disabled={disabled}>
        <IconComponent size={16} />
      </button>
    );
  };

  return (
    <div
      className={classNames(
        'absolute top-0 right-0 -mt-2 mr-2',
        'flex items-center gap-0.5 p-0.5',
        'bg-white border border-gray-300 rounded shadow-sm',
        'transition-opacity duration-150 z-20',
        {
          'opacity-100 pointer-events-auto': visible,
          'opacity-0 pointer-events-none': !visible,
        }
      )}
      aria-hidden={!visible}>
      {/* Drag Handle */}
      <button
        type='button'
        ref={dragHandleRef}
        {...handleRest}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={(event) => event.stopPropagation()}
        className={classNames(
          'flex justify-center items-center',
          'w-8 h-8 rounded',
          'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
          'transition-all duration-150',
          'cursor-grab active:cursor-grabbing'
        )}
        title={__('Drag to reorder', 'subtleforms')}
        aria-label={__('Drag field', 'subtleforms')}>
        {(() => {
          const DragIcon = getIcon('move');
          return <DragIcon size={16} />;
        })()}
      </button>

      {/* Separator */}
      <div className='w-px h-5 bg-gray-300 mx-0.5'></div>

      {/* Move Actions */}
      {renderButton(
        'arrow-up-alt2',
        __('Move up', 'subtleforms'),
        canMoveUp ? onMoveUp : null,
        !canMoveUp
      )}
      {renderButton(
        'arrow-down-alt2',
        __('Move down', 'subtleforms'),
        canMoveDown ? onMoveDown : null,
        !canMoveDown
      )}

      {/* Separator */}
      <div className='w-px h-5 bg-gray-300 mx-0.5'></div>

      {/* Duplicate Action */}
      {renderButton(
        'admin-page',
        __('Duplicate field', 'subtleforms'),
        onDuplicate,
        false
      )}

      {/* Separator */}
      <div className='w-px h-5 bg-gray-300 mx-0.5'></div>

      {/* Delete Action */}
      {renderButton(
        'trash',
        __('Delete field', 'subtleforms'),
        onDelete,
        false,
        'danger'
      )}
    </div>
  );
}
