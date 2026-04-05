import { memo, useMemo, useCallback, useEffect, useState, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useBuilder } from './context/BuilderContext';
import FieldRenderer from './FieldRenderer';
import ContainerRenderer from './ContainerRenderer';
import GroupRenderer from './GroupRenderer';
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

/**
 * Finds a node's parentId, columnIndex, and position within its parent.
 */
function getNodeLocation(tree, nodeId) {
  const node = tree.nodes[nodeId];
  if (!node) return null;
  const { parentId } = node;
  const parent = tree.nodes[parentId];
  if (!parent) return null;
  if (Array.isArray(parent.columns)) {
    for (let colIdx = 0; colIdx < parent.columns.length; colIdx++) {
      const idx = (parent.columns[colIdx] || []).indexOf(nodeId);
      if (idx !== -1) return { parentId, columnIndex: colIdx, position: idx };
    }
  }
  if (Array.isArray(parent.children)) {
    const idx = parent.children.indexOf(nodeId);
    if (idx !== -1) return { parentId, columnIndex: null, position: idx };
  }
  return null;
}

function SortableWrapper({
  nodeId,
  parentId,
  columnIndex,
  position,
  disabled,
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
    disabled, // prevents drag while multi-select is active
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

/**
 * FieldNode — memoized wrapper for a single leaf field on the canvas.
 *
 * Receives only primitive / stable-reference props so React.memo can bail out
 * when unrelated state (e.g. a different field's selectedId) changes.
 * `field` and `toolbarActions` are derived internally via useMemo so their
 * references only change when their inputs change.
 */
const FieldNode = memo(function FieldNode({
  nodeId,
  parentId,
  columnIndex,
  position,
  tree,
  selectedId,
  setSelectedId,
  onMove,
  onDelete,
  onDuplicate,
  validationErrorsByFieldKey,
  previewValidation,
  onLabelChange,
  isMultiSelected,
  onShiftSelect,
  isDragDisabled,
}) {
  const field = useMemo(() => nodeToField(tree, nodeId), [tree, nodeId]);

  const validationMessages = useMemo(() => {
    const key = field?.key;
    return key && validationErrorsByFieldKey[key]
      ? validationErrorsByFieldKey[key]
      : [];
  }, [field, validationErrorsByFieldKey]);

  const siblings = useMemo(
    () => nodeChildren(tree, parentId, columnIndex),
    [tree, parentId, columnIndex]
  );
  const canMoveUp = position > 0;
  const canMoveDown = position < siblings.length - 1;

  const onSelect = useCallback(() => setSelectedId(nodeId), [setSelectedId, nodeId]);

  const toolbarActions = useMemo(() => ({
    canMoveUp,
    canMoveDown,
    onMoveUp: canMoveUp
      ? () => onMove(nodeId, { parentId, columnIndex, position: position - 1 })
      : null,
    onMoveDown: canMoveDown
      ? () => onMove(nodeId, { parentId, columnIndex, position: position + 1 })
      : null,
    onDuplicate: () => {
      if (typeof onDuplicate === 'function') {
        onDuplicate(nodeId, { parentId, columnIndex, position: position + 1 });
      }
    },
    onDelete: () => onDelete(nodeId),
  }), [canMoveUp, canMoveDown, nodeId, parentId, columnIndex, position, onMove, onDuplicate, onDelete]);

  if (!field) return null;

  return (
    <SortableWrapper
      nodeId={nodeId}
      parentId={parentId}
      columnIndex={columnIndex}
      position={position}
      disabled={isDragDisabled}>
      {({ setNodeRef, style, dragHandleRef, dragHandleListeners }) => (
        <div
          ref={setNodeRef}
          style={style}
          onClickCapture={(e) => {
            if (e.shiftKey) {
              e.stopPropagation();
              onShiftSelect(nodeId);
            }
          }}>
          <FieldChrome
            isSelected={selectedId === nodeId}
            isMultiSelected={isMultiSelected}
            onSelect={onSelect}
            dragHandleRef={dragHandleRef}
            dragHandleListeners={dragHandleListeners}
            validationMessages={validationMessages}
            toolbarActions={toolbarActions}>
            <FieldRenderer
              field={field}
              previewMode={previewValidation}
              onLabelChange={onLabelChange}
            />
          </FieldChrome>
        </div>
      )}
    </SortableWrapper>
  );
});

/**
 * DragGhost — lightweight overlay card shown while dragging a field.
 */
const DragGhost = memo(function DragGhost({ tree, nodeId }) {
  const node = tree.nodes[nodeId];
  if (!node) return null;
  const label = node.config?.label || node.config?.title || node.type || '';
  return (
    <div className='sf-drag-ghost'>
      <span className='sf-drag-ghost__label'>{label}</span>
    </div>
  );
});

export default function FormBuilder() {
  // Get all state from context (including validationErrorsByFieldKey)
  const {
    tree,
    selectedId,
    selectedStepId,
    setSelectedId,
    actions: { onMove, onDelete, onDuplicate, onRequestInsert, onUpdate },
    validationErrors,
    validationErrorsByFieldKey: validationErrorsByFieldKeyFromContext,
  } = useBuilder();

  const [previewValidation, setPreviewValidation] = useState(false);

  // Multi-select: shift-click accumulates node IDs; bulk ops act on this set
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedIdsRef = useRef([]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // Drag overlay: tracks which node is actively being dragged
  const [activeNodeId, setActiveNodeId] = useState(null);

  // O(1) Set lookup — avoids O(n) .includes() per FieldNode in renderNode (Task 7: memo perf)
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Sync selectedIds with tree — prune stale IDs after undo/redo or cascading parent deletes (Task 3)
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const filtered = prev.filter((id) => id in tree.nodes);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [tree]);

  // Ref to always-current tree for keyboard handlers (avoids stale closure without re-registering)
  const treeRef = useRef(tree);
  useEffect(() => { treeRef.current = tree; });

  // Stable label change handler for inline editing
  const handleLabelChange = useCallback(
    (nodeId, label) => {
      onUpdate(nodeId, { label });
    },
    [onUpdate]
  );

  // Shift-click: toggle nodeId in the multi-select set (does not change single selectedId)
  const onShiftSelect = useCallback((nodeId) => {
    setSelectedIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  }, []);

  // Build validation errors map (fallback if not in context)
  const validationErrorsByFieldKey = useMemo(() => {
    if (validationErrorsByFieldKeyFromContext && Object.keys(validationErrorsByFieldKeyFromContext).length > 0) {
      return validationErrorsByFieldKeyFromContext;
    }
    
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
  }, [validationErrors, validationErrorsByFieldKeyFromContext]);

  const rootId = getRootNodeId();

  // Keyboard shortcuts: ESC deselect, Delete/Backspace remove field, Ctrl+D duplicate
  useEffect(() => {
    function isTypingTarget(target) {
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      );
    }

    const handleKeyDown = (e) => {
      // Guard first — never steal keys from inputs
      if (isTypingTarget(e.target)) return;

      // "/" → focus FieldDock search (quick field add without touching the mouse)
      if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sf:builder:quick-add'));
        return;
      }

      if (e.key === 'Escape') {
        if (selectedIdsRef.current.length > 0) {
          setSelectedIds([]);
        } else if (selectedId) {
          setSelectedId(null);
        }
        return;
      }

      const hasMulti = selectedIdsRef.current.length > 0;
      if (!selectedId && !hasMulti) return;

      // Delete / Backspace → remove selected field(s)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (hasMulti) {
          const ids = selectedIdsRef.current;
          const idsSet = new Set(ids);
          // Only delete top-level nodes — parent deletion cascades to children
          // Walk every node's ancestry; skip it if any ancestor is also selected
          // (deleting the ancestor cascades and avoids a double-delete attempt).
          // A visited set guards against cycles in malformed tree data.
          const topLevel = ids.filter((id) => {
            const visited = new Set([id]);
            let node = treeRef.current.nodes[id];
            while (node && node.parentId) {
              if (visited.has(node.parentId)) break; // cycle safety
              visited.add(node.parentId);
              if (idsSet.has(node.parentId)) return false;
              node = treeRef.current.nodes[node.parentId];
            }
            return true;
          });
          topLevel.forEach((id) => onDelete(id));
          setSelectedIds([]);
          setSelectedId(null);
        } else {
          onDelete(selectedId);
        }
        return;
      }

      // Ctrl/Cmd + D → duplicate selected field(s)
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        if (hasMulti) {
          // Sort descending by position so earlier dups don’t shift later indices
          const withLocs = selectedIdsRef.current
            .map((id) => ({ id, loc: getNodeLocation(treeRef.current, id) }))
            .filter(({ loc }) => loc !== null)
            .sort((a, b) => {
              if (
                a.loc.parentId === b.loc.parentId &&
                a.loc.columnIndex === b.loc.columnIndex
              ) {
                return b.loc.position - a.loc.position;
              }
              return 0;
            });
          withLocs.forEach(({ id, loc }) => {
            onDuplicate(id, { ...loc, position: loc.position + 1 });
          });
        } else {
          const loc = getNodeLocation(treeRef.current, selectedId);
          if (loc) {
            onDuplicate(selectedId, { ...loc, position: loc.position + 1 });
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, setSelectedId, onDelete, onDuplicate]);

  // Deselect when clicking empty canvas (not on a field)
  const handleCanvasClick = useCallback(
    (e) => {
      if (!e.target.closest('.sf-field-chrome')) {
        setSelectedId(null);
        setSelectedIds([]);
      }
    },
    [setSelectedId]
  );

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

  const handleDragStart = useCallback(({ active }) => {
    setActiveNodeId(active.id);
    setSelectedIds([]); // clear multi-select when drag begins
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      setActiveNodeId(null);
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (!activeData || !overData) return;

      if (activeData.parentId !== overData.parentId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[SubtleForms] Cannot move field between sections (cross-parent drag blocked)');
        }
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

    // Group fields (kind === 'group') are rendered as titled containers with fixed children.
    // This check must come BEFORE the generic isContainerNode check because group nodes
    // also have node.children = [] (making Array.isArray(node.children) true).
    if (node.kind === 'group') {
      const childIds = node.children || [];
      const parentColumnIndex = isColumnContainer(tree.nodes[parentId]) ? columnIndex : null;
      return (
        <SortableWrapper
          key={nodeId}
          nodeId={nodeId}
          parentId={parentId}
          columnIndex={parentColumnIndex}
          position={position}>
          {({ setNodeRef, style, dragHandleRef, dragHandleListeners }) => (
            <div ref={setNodeRef} style={style}>
              <GroupRenderer
                node={node}
                field={field}
                isSelected={selectedId === nodeId}
                onSelect={() => setSelectedId(nodeId)}
                onDelete={() => onDelete(nodeId)}
                dragHandleRef={dragHandleRef}
                dragHandleListeners={dragHandleListeners}>
                {childIds.map((childId, i) => renderNode(childId, nodeId, null, i))}
              </GroupRenderer>
            </div>
          )}
        </SortableWrapper>
      );
    }

    // Treat both column-containers AND any node that HAS a children array (even empty)
    // as container nodes so they render with drop zones immediately after being added.
    const isContainerNode =
      isColumnContainer(node) || Array.isArray(node.children);

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
                    compact
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

    return (
      <FieldNode
        key={nodeId}
        nodeId={nodeId}
        parentId={parentId}
        columnIndex={columnIndex}
        position={position}
        tree={tree}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        onMove={onMove}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        validationErrorsByFieldKey={validationErrorsByFieldKey}
        previewValidation={previewValidation}
        onLabelChange={handleLabelChange}
        isMultiSelected={selectedIdsSet.has(nodeId)}
        onShiftSelect={onShiftSelect}
        isDragDisabled={selectedIds.length > 1}
      />
    );
  };

  return (
    <div className='subtleforms-builder-canvas' onClick={handleCanvasClick}>
      <div className='subtleforms-builder-canvas__surface'>          <div className='subtleforms-builder-canvas__toolbar'>
            <button
              type='button'
              className={`sf-preview-toggle${previewValidation ? ' sf-preview-toggle--active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setPreviewValidation((v) => !v); }}>
              {previewValidation ? __('Exit Preview', 'subtleforms') : __('Preview Errors', 'subtleforms')}
            </button>
          </div>        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          autoScroll={{ threshold: { x: 0.2, y: 0.2 }, acceleration: 25, interval: 5 }}>
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
          <DragOverlay dropAnimation={null}>
            {activeNodeId ? <DragGhost tree={tree} nodeId={activeNodeId} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
