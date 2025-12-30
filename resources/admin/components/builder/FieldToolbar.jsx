import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';

/**
 * FieldToolbar
 * Enhanced UI styling: glass effect, clearer affordances, smoother motion.
 */
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

  const stop = (e) => e.stopPropagation();

  const createHandler = (callback) => (event) => {
    stop(event);
    callback?.();
  };

  const renderButton = (
    iconName,
    label,
    handler,
    disabled,
    variant = 'default'
  ) => {
    const Icon = getIcon(iconName);

    return (
      <button
        type='button'
        onClick={createHandler(handler)}
        onMouseDown={stop}
        onPointerDown={stop}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={clsx(
          'sf-flex sf-justify-center sf-items-center',
          'sf-w-8 sf-h-8 sf-rounded-md',
          'sf-transition-all sf-duration-150 sf-ease-out',
          'focus:sf-outline-none focus-visible:sf-ring-2 focus-visible:sf-ring-offset-1',
          {
            'sf-text-gray-400 sf-cursor-not-allowed': disabled,

            'sf-text-gray-600 hover:sf-text-gray-900 hover:sf-bg-gray-100 active:sf-scale-95':
              !disabled && variant === 'default',

            'sf-text-red-600 hover:sf-bg-red-50 hover:sf-text-red-700 active:sf-scale-95':
              !disabled && variant === 'danger',
          }
        )}>
        <Icon size={16} />
      </button>
    );
  };

  return (
    <div
      aria-hidden={!visible}
      data-tour='field-toolbar'
      className={clsx(
        'sf-top-0 sf-right-0 sf-absolute -sf-mt-2 sf-mr-2',
        'sf-flex sf-items-center sf-gap-1 sf-p-1',
        'sf-rounded-lg sf-border sf-border-gray-200',
        'sf-bg-white/90 sf-backdrop-blur',
        'sf-shadow-md',
        'sf-transition-all sf-duration-200 sf-ease-out sf-z-20',
        {
          'sf-opacity-100 sf-translate-y-0 sf-pointer-events-auto': visible,
          'sf-opacity-0 sf-translate-y-1 sf-pointer-events-none': !visible,
        }
      )}>
      {/* Drag Handle */}
      <button
        type='button'
        ref={dragHandleRef}
        {...handleRest}
        onPointerDown={(e) => {
          stop(e);
          onPointerDown?.(e);
        }}
        onMouseDown={(e) => {
          stop(e);
          onMouseDown?.(e);
        }}
        onTouchStart={(e) => {
          stop(e);
          onTouchStart?.(e);
        }}
        onClick={stop}
        title={__('Drag to reorder', 'subtleforms')}
        aria-label={__('Drag field', 'subtleforms')}
        className={clsx(
          'sf-flex sf-justify-center sf-items-center',
          'sf-w-8 sf-h-8 sf-rounded-md',
          'sf-text-gray-500',
          'hover:sf-bg-gray-100 hover:sf-text-gray-700',
          'active:sf-scale-95',
          'sf-cursor-grab active:sf-cursor-grabbing',
          'sf-transition-all sf-duration-150'
        )}>
        {(() => {
          const DragIcon = getIcon('move');
          return <DragIcon size={16} />;
        })()}
      </button>

      <div className='sf-bg-gray-200 sf-w-px sf-h-5' />

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

      <div className='sf-bg-gray-200 sf-w-px sf-h-5' />

      {renderButton(
        'admin-page',
        __('Duplicate field', 'subtleforms'),
        onDuplicate,
        false
      )}

      <div className='sf-bg-gray-200 sf-w-px sf-h-5' />

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
