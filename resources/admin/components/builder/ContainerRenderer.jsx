import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../../ui/Icon';
import { getIcon } from './utils/iconMap';
import './ContainerRenderer.scss';

/**
 * Canvas chrome for a container (Repeater, Group, Columns).
 *
 * The header selects the container; only the handle drags it, so pressing
 * anywhere else (including its drop zone) never starts a container drag.
 * Children handle their own clicks and keys, so selecting a child never
 * selects the container (QA-10).
 */
export default function ContainerRenderer({
  node,
  columns,
  isSelected,
  onSelect,
  onDelete,
  renderColumn,
  spacing,
  dragHandleRef,
  dragHandleListeners,
}) {
  const isColumnLayout = columns.length > 1;
  const isStep = node.type === 'step';
  const isRepeater = node.type === 'repeat_container';
  const title = isStep
    ? node.config?.title || __('Step', 'subtleforms')
    : node.config?.label ||
      (isRepeater
        ? __('Repeater', 'subtleforms')
        : isColumnLayout
          ? __('Columns', 'subtleforms')
          : __('Group', 'subtleforms'));
  const gap = parseInt(spacing, 10) || 16;

  const { onPointerDown, onMouseDown, onTouchStart, ...handleRest } =
    dragHandleListeners || {};

  const stopThen = (fn) => (event) => {
    event.stopPropagation();
    if (typeof fn === 'function') {
      fn(event);
    }
  };

  const NodeIcon = getIcon(node.type);
  const min = parseInt(node.config?.min, 10);
  const max = parseInt(node.config?.max, 10);

  return (
    <div
      className={clsx('sf-container-renderer', {
        'is-selected': isSelected,
        'is-step': isStep,
        'is-repeater': isRepeater,
      })}
      data-node-id={node.id}
      tabIndex={0}
      role='group'
      aria-label={sprintf(
        /* translators: %s: container name */
        __('%s container. Press Enter to select.', 'subtleforms'),
        title
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}>
      <div className='sf-container-renderer__header'>
        <div className='sf-container-renderer__header-left'>
          {dragHandleRef && !isStep && (
            <button
              type='button'
              ref={dragHandleRef}
              {...handleRest}
              onPointerDown={stopThen(onPointerDown)}
              onMouseDown={stopThen(onMouseDown)}
              onTouchStart={stopThen(onTouchStart)}
              onClick={(event) => event.stopPropagation()}
              aria-label={__('Drag container', 'subtleforms')}
              className='sf-container-renderer__handle'>
              <Icon.Move size={16} />
            </button>
          )}
          <NodeIcon size={18} aria-hidden='true' />
          <div className='sf-container-renderer__header-title'>
            <strong>{title}</strong>
            {isStep && node.config?.description && (
              <span className='sf-container-renderer__description'>{node.config.description}</span>
            )}
            {isRepeater && (
              <span className='sf-container-renderer__meta'>
                {sprintf(
                  /* translators: 1: minimum groups, 2: maximum groups */
                  __('Visitors add %1$d to %2$d groups', 'subtleforms'),
                  Number.isFinite(min) ? min : 1,
                  Number.isFinite(max) ? max : 5
                )}
              </span>
            )}
          </div>
        </div>
        {!isStep && (
          <button
            type='button'
            className='sf-container-renderer__delete'
            aria-label={__('Delete container', 'subtleforms')}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}>
            <Icon.Trash size={14} />
          </button>
        )}
      </div>

      <div className='sf-container-renderer__body'>
        <div
          className={clsx('sf-container-renderer__columns', { 'is-grid': isColumnLayout })}
          style={
            isColumnLayout
              ? { gap: `${gap}px`, gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }
              : undefined
          }>
          {columns.map((columnItems, index) => (
            <div key={`${node.id}-col-${index}`} className='sf-container-renderer__column'>
              {renderColumn(columnItems, index)}
            </div>
          ))}
        </div>
        {isRepeater && (
          <div className='sf-container-renderer__repeat-preview' aria-hidden='true'>
            <span className='sf-container-renderer__repeat-button'>
              <Icon.Plus size={14} />
              {node.config?.buttonLabel || __('Add another', 'subtleforms')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
