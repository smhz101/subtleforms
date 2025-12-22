import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { __ } from '@wordpress/i18n';
import InsertFieldButton from './InsertFieldButton';

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
  const dropzoneClassName = [
    'subtleforms-column-dropzone',
    isOver ? 'is-over' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const padding = `${Math.max(8, Math.round(gap / 2))}px`;

  return (
    <div
      ref={setNodeRef}
      className={dropzoneClassName}
      style={{
        '--subtleforms-dropzone-padding': padding,
        '--subtleforms-dropzone-gap': `${gap}px`,
      }}>
      <InsertFieldButton
        parentId={containerId}
        columnIndex={columnIndex}
        position={0}
        onRequestInsert={onRequestInsert}
        label={__('Add field', 'subtleforms')}
      />

      <SortableContext
        id={droppableId}
        items={items}
        strategy={verticalListSortingStrategy}>
        {items.map((itemId, index) => (
          <div key={itemId} className='subtleforms-dropzone-item'>
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
        <div className='subtleforms-dropzone-empty'>
          {__('Drop fields here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
