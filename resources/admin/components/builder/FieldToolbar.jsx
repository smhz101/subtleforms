import { Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

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

  const wrapperStyle = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '4px',
    padding: '4px',
    background: '#fff',
    borderRadius: '6px',
    border: '1px solid #dcdcde',
    boxShadow: '0 4px 16px rgba(17, 17, 17, 0.12)',
    transition: 'opacity 0.15s ease',
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: 2,
  };

  const buttonStyle = {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    border: '1px solid transparent',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#1e1e1e',
    transition:
      'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  };

  const disabledStyle = {
    cursor: 'default',
    color: '#a7aaad',
  };

  const renderButton = (icon, label, handler, disabled) => (
    <button
      type='button'
      onClick={createHandler(handler)}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        ...buttonStyle,
        ...(disabled ? disabledStyle : {}),
      }}
      aria-label={label}
      disabled={disabled}>
      <Icon icon={icon} size={16} />
    </button>
  );

  return (
    <div style={wrapperStyle} aria-hidden={!visible}>
      <button
        type='button'
        ref={dragHandleRef}
        {...handleRest}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={(event) => event.stopPropagation()}
        style={{
          ...buttonStyle,
          cursor: 'grab',
        }}
        aria-label={__('Drag field', 'subtleforms')}>
        <Icon icon='drag-handle' size={16} />
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
