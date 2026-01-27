import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import InsertFieldButton from './InsertFieldButton';
import { ContextualTip } from '../ui';
import './ColumnDropZone.scss';

export default function ColumnDropZone({
  containerId,
  columnIndex,
  items,
  onRequestInsert,
  renderItem,
  spacing,
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
        <div className='sf-column-dropzone__empty'>
          <ContextualTip 
            id='builder-canvas-empty'
            variant='info'
            dismissible>
            {__('👋 Get started by clicking "Add Field" below, or drag a field from the panel on the left. You can always rearrange them later!', 'subtleforms')}
          </ContextualTip>
        </div>
      )}
    </div>
  );
}
