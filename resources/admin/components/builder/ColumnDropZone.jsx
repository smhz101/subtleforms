import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
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
            <svg
              className='sf-column-dropzone__empty-icon'
              xmlns='http://www.w3.org/2000/svg'
              width='18'
              height='18'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
              aria-hidden='true'>
              <path d='M12 5v14M5 12l7 7 7-7'/>
            </svg>
            <span>{__('Drop a field here', 'subtleforms')}</span>
          </div>
        ) : (
          <div className='sf-column-dropzone__empty'>
            <svg
              className='sf-column-dropzone__empty-icon'
              xmlns='http://www.w3.org/2000/svg'
              width='28'
              height='28'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
              aria-hidden='true'>
              <rect x='3' y='3' width='18' height='4' rx='1'/>
              <rect x='3' y='10' width='18' height='4' rx='1'/>
              <rect x='3' y='17' width='11' height='4' rx='1'/>
              <path d='M18 19l2-2-2-2'/>
              <path d='M16 17h4'/>
            </svg>
            <span>{__('Drag fields here or click \u002b to add', 'subtleforms')}</span>
          </div>
        )
      )}
    </div>
  );
}
