import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../../ui/Icon';
import InsertFieldButton from './InsertFieldButton';
import { useDropTarget } from './dnd/BuilderDnd';
import './ColumnDropZone.scss';

export default function ColumnDropZone({
  containerId,
  columnIndex,
  items,
  onRequestInsert,
  renderItem,
  spacing,
  compact = false,
  getItemStyle,
  getItemClassName,
}) {
  const droppableId =
    columnIndex === null
      ? `${containerId}-root`
      : `${containerId}-col-${columnIndex}`;

  const { setNodeRef } = useDroppable({
    id: droppableId,
    data: {
      kind: 'zone',
      parentId: containerId,
      columnIndex,
      position: items.length,
    },
  });

  // Highlight the zone that will receive the drop, whether the pointer is
  // over the zone itself or over one of its fields.
  const target = useDropTarget();
  const isOver =
    !!target &&
    target.parentId === containerId &&
    (target.columnIndex ?? null) === (columnIndex ?? null);

  const gap = parseInt(spacing, 10) || 16;
  const padding = `${Math.max(8, Math.round(gap / 2))}px`;

  return (
    <div
      ref={setNodeRef}
      className={clsx('sf-column-dropzone', { 'is-over': isOver })}
      data-dropzone={droppableId}
      style={{
        '--dropzone-padding': padding,
        '--dropzone-gap': `${gap}px`,
      }}>
      <InsertFieldButton
        parentId={containerId}
        columnIndex={columnIndex}
        position={0}
        onRequestInsert={onRequestInsert}
        label={__('Add Field', 'subtleforms')}
      />

      <SortableContext
        id={droppableId}
        items={items}
        strategy={rectSortingStrategy}>
        <div className='sf-column-dropzone__items'>
          {items.map((itemId, index) => (
            <div
              key={itemId}
              className={clsx('sf-column-dropzone__item', getItemClassName?.(itemId))}
              style={getItemStyle?.(itemId)}>
              {renderItem(itemId, index)}
              <InsertFieldButton
                parentId={containerId}
                columnIndex={columnIndex}
                position={index + 1}
                onRequestInsert={onRequestInsert}
              />
            </div>
          ))}
        </div>
      </SortableContext>

      {items.length === 0 && (
        compact ? (
          <div className='sf-column-dropzone__empty sf-column-dropzone__empty--compact'>
            <Icon.ArrowDown
              size={18}
              className='sf-column-dropzone__empty-icon'
              aria-hidden='true'
            />
            <span>{__('Drop a field here', 'subtleforms')}</span>
          </div>
        ) : (
          <div className='sf-column-dropzone__empty'>
            <Icon.LayoutGrid
              size={28}
              className='sf-column-dropzone__empty-icon'
              aria-hidden='true'
            />
            <span>{__('Drag fields here or click \u002b to add', 'subtleforms')}</span>
          </div>
        )
      )}
    </div>
  );
}
