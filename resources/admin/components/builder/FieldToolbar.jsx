import { __, sprintf } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
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
  width,
  onWidthChange,
  moveTargets = [],
  onMoveTo,
}) {
  const [widthOpen, setWidthOpen] = useState(false);
  // `label` is the compact glyph on the button; `name` is what screen readers
  // hear (2.2.1, bug 13).
  const WIDTHS = [
    { value: '100', label: __('Full', 'subtleforms'), name: __('Full', 'subtleforms') },
    { value: '75', label: '¾', name: __('Three quarters', 'subtleforms') },
    { value: '66', label: '⅔', name: __('Two thirds', 'subtleforms') },
    { value: '50', label: '½', name: __('Half', 'subtleforms') },
    { value: '33', label: '⅓', name: __('One third', 'subtleforms') },
    { value: '25', label: '¼', name: __('One quarter', 'subtleforms') },
  ];
  const currentWidth = WIDTHS.find((w) => w.value === (width || '100')) || WIDTHS[0];
  const { onPointerDown, onMouseDown, onTouchStart, ...handleRest } =
    dragHandleListeners || {};

  const stop = (e) => e.stopPropagation();
  const MoveToIcon = getIcon('move-to');

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
        className={clsx('sf-field-toolbar__button', {
          'sf-field-toolbar__button--disabled': disabled,
          'sf-field-toolbar__button--default':
            !disabled && variant === 'default',
          'sf-field-toolbar__button--danger': !disabled && variant === 'danger',
        })}>
        <Icon size={16} />
      </button>
    );
  };

  return (
    <div
      aria-hidden={!visible}
      data-tour='field-toolbar'
      className={clsx('sf-field-toolbar', {
        'sf-field-toolbar--visible': visible,
        'sf-field-toolbar--hidden': !visible,
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
        className='sf-field-toolbar__button sf-field-toolbar__button--drag'>
        {(() => {
          const DragIcon = getIcon('move');
          return <DragIcon size={16} />;
        })()}
      </button>

      <div className='sf-field-toolbar__divider' />

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

      {onMoveTo && moveTargets.length > 0 && (
        <span onMouseDown={stop} onPointerDown={stop} className='sf-field-toolbar__move-to'>
          <DropdownMenu
            icon={<MoveToIcon size={16} />}
            label={__('Move to', 'subtleforms')}
            toggleProps={{ className: 'sf-field-toolbar__button sf-field-toolbar__button--default', size: 'small' }}
            popoverProps={{ placement: 'bottom-start' }}>
            {({ onClose }) => (
              <MenuGroup label={__('Move field into', 'subtleforms')}>
                {moveTargets.map((target) => (
                  <MenuItem
                    key={`${target.parentId}-${target.columnIndex ?? 'x'}`}
                    style={{ paddingInlineStart: `${12 + target.depth * 12}px` }}
                    onClick={(event) => {
                      event?.stopPropagation?.();
                      onMoveTo({ parentId: target.parentId, columnIndex: target.columnIndex });
                      onClose();
                    }}>
                    {target.label}
                  </MenuItem>
                ))}
              </MenuGroup>
            )}
          </DropdownMenu>
        </span>
      )}

      {onWidthChange && (
        <>
          <div className='sf-field-toolbar__divider' />
          <div className='sf-field-toolbar__width'>
            <button
              type='button'
              className='sf-field-toolbar__button sf-field-toolbar__button--text'
              aria-haspopup='true'
              aria-expanded={widthOpen}
              aria-label={sprintf(
                /* translators: %s: current field width, e.g. Full or Half */
                __('Field width: %s', 'subtleforms'),
                currentWidth.name
              )}
              title={sprintf(
                /* translators: %s: current field width, e.g. Full or Half */
                __('Field width: %s', 'subtleforms'),
                currentWidth.name
              )}
              onMouseDown={stop}
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                setWidthOpen((o) => !o);
              }}>
              {currentWidth.label}
            </button>
            {widthOpen && (
              <div className='sf-field-toolbar__width-menu' role='menu'>
                {WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    type='button'
                    role='menuitemradio'
                    aria-checked={w.value === currentWidth.value}
                    aria-label={w.name}
                    className={clsx('sf-field-toolbar__width-option', {
                      'is-active': w.value === currentWidth.value,
                    })}
                    onMouseDown={stop}
                    onPointerDown={stop}
                    onClick={(e) => {
                      stop(e);
                      onWidthChange(w.value === '100' ? '' : w.value);
                      setWidthOpen(false);
                    }}>
                    {w.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className='sf-field-toolbar__divider' />

      {renderButton(
        'admin-page',
        __('Duplicate field', 'subtleforms'),
        onDuplicate,
        false
      )}

      <div className='sf-field-toolbar__divider' />

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
