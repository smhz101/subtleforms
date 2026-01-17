import { useMemo, useCallback } from '@wordpress/element';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Log version on module load
console.log(
  '%c[SubtleForms] Builder v1.7.3 Loaded',
  'background: #4f9cf9; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold'
);
import { useBuilder } from './context/BuilderContext';
import FieldRenderer from './FieldRenderer';
import ContainerRenderer from './ContainerRenderer';
import ColumnDropZone from './ColumnDropZone';
import FieldChrome from './FieldChrome';
import StepCanvas from './StepCanvas';
import {
  nodeToField,
  isColumnContainer,
  nodeChildren,
  getRootNodeId,
} from './utils/schemaTree';
import './FormBuilder.scss';

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

export default function FormBuilder() {
  // Get all state from context
  const {
    tree,
    selectedId,
    selectedStepId,
    setSelectedId,
    actions: { onMove, onDelete, onDuplicate, onRequestInsert },
    validationErrors,
  } = useBuilder();

  // Build validation errors map
  const validationErrorsByFieldKey = useMemo(() => {
    const map = {};
    if (!Array.isArray(validationErrors)) {
      return map;
    }
    validationErrors.forEach((err) => {
      const fieldKey = err?.fieldKey || err?.field_key || null;
      const message = err?.message || null;
      if (!fieldKey || !message) {
        return;
      }
      if (!map[fieldKey]) {
        map[fieldKey] = [];
      }
      map[fieldKey].push(message);
    });
    return map;
  }, [validationErrors]);

  const rootId = getRootNodeId();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Detect if this is a multi-step form
  const rootChildren = useMemo(() => {
    return nodeChildren(tree, rootId);
  }, [tree, rootId]);

  const stepNodes = useMemo(() => {
    return rootChildren.filter((id) => tree.nodes[id]?.type === 'step');
  }, [rootChildren, tree]);

  const isMultiStepForm = stepNodes.length > 0;

  // For multi-step forms, get the active step
  const activeStep = useMemo(() => {
    if (!isMultiStepForm || !selectedStepId) return null;
    return tree.nodes[selectedStepId];
  }, [isMultiStepForm, selectedStepId, tree]);

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
          position={position}>
          {({ setNodeRef, style, dragHandleRef, dragHandleListeners }) => (
            <div ref={setNodeRef} style={style}>
              <ContainerRenderer
                node={node}
                columns={columns}
                isSelected={selectedId === nodeId}
                onSelect={() => setSelectedId(nodeId)}
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
        </SortableWrapper>
      );
    }

    if (!field) {
      return null;
    }

    const validationMessages =
      field?.key && validationErrorsByFieldKey[field.key]
        ? validationErrorsByFieldKey[field.key]
        : [];

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
        position={position}>
        {({ setNodeRef, style, dragHandleRef, dragHandleListeners }) => (
          <div ref={setNodeRef} style={style}>
            <FieldChrome
              isSelected={selectedId === nodeId}
              onSelect={() => setSelectedId(nodeId)}
              dragHandleRef={dragHandleRef}
              dragHandleListeners={dragHandleListeners}
              validationMessages={validationMessages}
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
      </SortableWrapper>
    );
  };

  return (
    <div className='subtleforms-builder-canvas'>
      <div className='subtleforms-builder-canvas__surface'>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {isMultiStepForm && activeStep ? (
            /* Multi-step form: Show step-scoped canvas */
            <StepCanvas
              stepId={selectedStepId}
              stepNumber={stepNodes.indexOf(selectedStepId) + 1}
              totalSteps={stepNodes.length}
              renderNode={renderNode}
            />
          ) : (
            /* Regular form: Show all fields */
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
          )}
        </DndContext>
      </div>
    </div>
  );
}
