import { useMemo, useCallback } from '@wordpress/element';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FieldRenderer from './FieldRenderer';
import ContainerRenderer from './ContainerRenderer';
import ColumnDropZone from './ColumnDropZone';
import FieldChrome from './FieldChrome';
import {
  nodeToField,
  isColumnContainer,
  nodeChildren,
} from './utils/schemaTree';

function SortableWrapper({
  nodeId,
  parentId,
  columnIndex,
  position,
  children,
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: nodeId,
    data: {
      parentId,
      columnIndex,
      position,
    },
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const dragHandleListeners = {
    ...attributes,
    ...listeners,
  };

  return children({
    setNodeRef,
    style,
    isDragging,
    dragHandleRef: setActivatorNodeRef,
    dragHandleListeners,
  });
}

export default function FormBuilder({
  tree,
  rootId,
  selectedId,
  selectedStepId,
  onSelect,
  onDelete,
  onMove,
  onDuplicate,
  onRequestInsert,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const rootChildren = useMemo(() => {
    const allChildren = nodeChildren(tree, rootId);

    // If selectedStepId is set, only show that step's children
    if (selectedStepId) {
      const stepNode = tree.nodes[selectedStepId];
      if (stepNode && stepNode.type === 'step') {
        return [selectedStepId];
      }
    }

    // Otherwise show all children (backward compatible with non-step forms)
    return allChildren;
  }, [tree, rootId, selectedStepId]);

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (!activeData || !overData) return;

      if (activeData.parentId !== overData.parentId) {
        return;
      }

      if (
        active.id === over.id &&
        activeData.columnIndex === overData.columnIndex &&
        activeData.position === overData.position
      ) {
        return;
      }

      onMove(active.id, {
        parentId: activeData.parentId,
        columnIndex: overData.columnIndex,
        position: overData.position,
      });
    },
    [onMove]
  );

  const renderNode = (nodeId, parentId, columnIndex, position) => {
    const node = tree.nodes[nodeId];
    if (!node) {
      return null;
    }

    const field = nodeToField(tree, nodeId);
    const isContainerNode =
      isColumnContainer(node) || (node.children && node.children.length);

    if (isContainerNode) {
      const columns = isColumnContainer(node)
        ? node.columns || []
        : [node.children || []];
      const spacing = parseInt(node.config?.spacing, 10) || 16;
      const parentColumnIndex = isColumnContainer(tree.nodes[parentId])
        ? columnIndex
        : null;

      return (
        <SortableWrapper
          key={nodeId}
          nodeId={nodeId}
          parentId={parentId}
          columnIndex={parentColumnIndex}
          position={position}
          children={({
            setNodeRef,
            style,
            dragHandleRef,
            dragHandleListeners,
          }) => (
            <div ref={setNodeRef} style={style}>
              <ContainerRenderer
                node={node}
                columns={columns}
                isSelected={selectedId === nodeId}
                onSelect={() => onSelect(nodeId)}
                onDelete={() => onDelete(nodeId)}
                spacing={spacing}
                dragHandleRef={dragHandleRef}
                dragHandleListeners={dragHandleListeners}
                renderColumn={(columnChildren, colIndex) => (
                  <ColumnDropZone
                    key={`${nodeId}-${colIndex}`}
                    containerId={nodeId}
                    columnIndex={isColumnContainer(node) ? colIndex : null}
                    items={columnChildren}
                    onRequestInsert={onRequestInsert}
                    spacing={spacing}
                    renderItem={(childId, childPosition) =>
                      renderNode(
                        childId,
                        nodeId,
                        isColumnContainer(node) ? colIndex : null,
                        childPosition
                      )
                    }
                  />
                )}
              />
            </div>
          )}
        />
      );
    }

    if (!field) {
      return null;
    }

    const siblings = nodeChildren(tree, parentId, columnIndex);
    const canMoveUp = position > 0;
    const canMoveDown = position < siblings.length - 1;

    const moveUp = () => {
      if (!canMoveUp) {
        return;
      }
      onMove(nodeId, {
        parentId,
        columnIndex,
        position: position - 1,
      });
    };

    const moveDown = () => {
      if (!canMoveDown) {
        return;
      }
      onMove(nodeId, {
        parentId,
        columnIndex,
        position: position + 1,
      });
    };

    const duplicate = () => {
      if (typeof onDuplicate === 'function') {
        onDuplicate(nodeId, {
          parentId,
          columnIndex,
          position: position + 1,
        });
      }
    };

    return (
      <SortableWrapper
        key={nodeId}
        nodeId={nodeId}
        parentId={parentId}
        columnIndex={columnIndex}
        position={position}
        children={({
          setNodeRef,
          style,
          dragHandleRef,
          dragHandleListeners,
        }) => (
          <div ref={setNodeRef} style={style}>
            <FieldChrome
              isSelected={selectedId === nodeId}
              onSelect={() => onSelect(nodeId)}
              dragHandleRef={dragHandleRef}
              dragHandleListeners={dragHandleListeners}
              toolbarActions={{
                canMoveUp,
                canMoveDown,
                onMoveUp: moveUp,
                onMoveDown: moveDown,
                onDuplicate: duplicate,
                onDelete: () => onDelete(nodeId),
              }}>
              <FieldRenderer field={field} />
            </FieldChrome>
          </div>
        )}
      />
    );
  };

  return (
    <div className='subtleforms-builder-canvas'>
      <div className='subtleforms-builder-canvas__scroll'>
        <div className='subtleforms-builder-canvas__surface'>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <ColumnDropZone
              containerId={rootId}
              columnIndex={null}
              items={rootChildren}
              onRequestInsert={onRequestInsert}
              spacing={24}
              renderItem={(nodeId, index) =>
                renderNode(nodeId, rootId, null, index)
              }
            />
          </DndContext>
        </div>
      </div>
    </div>
  );
}
