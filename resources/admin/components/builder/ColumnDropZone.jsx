import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../ui/Icon';
import InsertFieldButton from './InsertFieldButton';
import './ColumnDropZone.scss';

export default function ColumnDropZone({
  containerId,
  columnIndex,
  items,
  onRequestInsert,
  renderItem,
  spacing,
  compact = false,
}) {
  const droppableId =
    columnIndex === null
      ? `${containerId}-root`
      : `${containerId}-col-${columnIndex}`;

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      parentId: containerId,
      columnIndex,
      position: items.length,
    },
  });

  const gap = parseInt(spacing, 10) || 16;
  const padding = `${Math.max(8, Math.round(gap / 2))}px`;

  return (
    <div
      ref={setNodeRef}
      className={clsx('sf-column-dropzone', { 'is-over': isOver })}
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
        strategy={verticalListSortingStrategy}>
        {items.map((itemId, index) => (
          <div key={itemId} className='sf-column-dropzone__item'>
            {renderItem(itemId, index)}
            <InsertFieldButton
              parentId={containerId}
              columnIndex={columnIndex}
              position={index + 1}
              onRequestInsert={onRequestInsert}
            />
          </div>
        ))}
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
