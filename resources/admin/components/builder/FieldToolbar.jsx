import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';
import './FieldToolbar.scss';

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
        className={clsx('field-toolbar__button', {
          'field-toolbar__button--disabled': disabled,
          'field-toolbar__button--default': !disabled && variant === 'default',
          'field-toolbar__button--danger': !disabled && variant === 'danger',
        })}>
        <Icon size={16} />
      </button>
    );
  };

  return (
    <div
      aria-hidden={!visible}
      data-tour='field-toolbar'
      className={clsx('field-toolbar', {
        'field-toolbar--visible': visible,
        'field-toolbar--hidden': !visible,
      })}>
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
        className='field-toolbar__button field-toolbar__button--drag'>
        {(() => {
          const DragIcon = getIcon('move');
          return <DragIcon size={16} />;
        })()}
      </button>

      <div className='field-toolbar__divider' />

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

      <div className='field-toolbar__divider' />

      {renderButton(
        'admin-page',
        __('Duplicate field', 'subtleforms'),
        onDuplicate,
        false
      )}

      <div className='field-toolbar__divider' />

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
