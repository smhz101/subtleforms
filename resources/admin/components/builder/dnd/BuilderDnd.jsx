/**
 * One drag and drop context for the whole builder (2.3.1).
 *
 * It wraps the field library, the step tabs and the canvas, so a field can
 * be dragged from the library onto the canvas, into a Repeater, Group or
 * column, between containers, and onto a step tab. The drop target is the
 * deepest drop zone under the pointer, so nested containers take the drop
 * instead of their parent, and a container only drags by its handle.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from '@wordpress/element';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { resolveDrop } from './resolveDrop';

const DropTargetContext = createContext(null);

/** The drop target being hovered: { parentId, columnIndex } or { stepId }. */
export function useDropTarget() {
  return useContext(DropTargetContext);
}

export const LIBRARY_PREFIX = 'library:';
export const STEP_TAB_PREFIX = 'steptab:';

function descendantsOf(tree, nodeId, bucket = new Set()) {
  const node = tree.nodes[nodeId];
  if (!node) return bucket;
  bucket.add(nodeId);
  (node.children || []).forEach((id) => descendantsOf(tree, id, bucket));
  (node.columns || []).forEach((col) => (col || []).forEach((id) => descendantsOf(tree, id, bucket)));
  return bucket;
}

function area(rect) {
  return rect ? rect.width * rect.height : Infinity;
}

/** Normalised description of what is being dragged. */
function describeActive(active) {
  const data = active?.data?.current || {};
  if (data.kind === 'library') {
    return { kind: 'library', fieldType: data.fieldType, label: data.label };
  }
  return { kind: 'node', nodeId: active?.id };
}

/** Normalised description of what is under the drag. */
function describeOver(over) {
  const data = over?.data?.current || {};
  if (data.kind === 'zone') {
    return { kind: 'zone', parentId: data.parentId, columnIndex: data.columnIndex ?? null };
  }
  if (data.kind === 'steptab') {
    return { kind: 'steptab', stepId: data.stepId };
  }
  if (over && data.parentId !== undefined) {
    return {
      kind: 'node',
      nodeId: over.id,
      parentId: data.parentId,
      columnIndex: data.columnIndex ?? null,
      position: data.position,
    };
  }
  return null;
}

function pointerY(event) {
  const start = event?.activatorEvent;
  if (start && typeof start.clientY === 'number') {
    return start.clientY + (event.delta?.y || 0);
  }
  const rect = event?.active?.rect?.current?.translated;
  return rect ? rect.top + rect.height / 2 : null;
}

function isPlaceAfter(event) {
  const y = pointerY(event);
  const rect = event?.over?.rect;
  if (y === null || !rect) return false;
  return y > rect.top + rect.height / 2;
}

export default function BuilderDnd({ tree, onInsert, onMove, onMoveToStep, onDragStart, children }) {
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const [active, setActive] = useState(null);
  const [target, setTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Deepest droppable under the pointer, never the dragged node or anything
  // inside it.
  const collisionDetection = useCallback((args) => {
    const current = describeActive(args.active);
    let blocked = new Set();
    if (current.kind === 'node') {
      blocked = descendantsOf(treeRef.current, current.nodeId);
    }
    const allowed = args.droppableContainers.filter((container) => {
      if (blocked.has(container.id)) return false;
      const data = container.data?.current;
      if (data?.kind === 'zone' && blocked.has(data.parentId)) return false;
      return true;
    });
    const filteredArgs = { ...args, droppableContainers: allowed };
    const hits = pointerWithin(filteredArgs);
    if (hits.length) {
      const sorted = [...hits].sort(
        (a, b) => area(args.droppableRects.get(a.id)) - area(args.droppableRects.get(b.id))
      );
      return [sorted[0]];
    }
    return closestCenter(filteredArgs);
  }, []);

  const handleDragStart = useCallback(
    (event) => {
      setActive(describeActive(event.active));
      onDragStart?.(event);
    },
    [onDragStart]
  );

  const handleDragOver = useCallback((event) => {
    const command = resolveDrop(
      treeRef.current,
      describeActive(event.active),
      describeOver(event.over),
      { placeAfter: isPlaceAfter(event) }
    );
    if (!command) {
      setTarget(null);
    } else if (command.type === 'moveToStep' || (describeOver(event.over)?.kind === 'steptab')) {
      setTarget({ stepId: command.stepId || command.parentId });
    } else {
      setTarget({ parentId: command.parentId, columnIndex: command.columnIndex ?? null });
    }
  }, []);

  const reset = useCallback(() => {
    setActive(null);
    setTarget(null);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      reset();
      const command = resolveDrop(
        treeRef.current,
        describeActive(event.active),
        describeOver(event.over),
        { placeAfter: isPlaceAfter(event) }
      );
      if (!command) return;
      if (command.type === 'insert') {
        onInsert(command.fieldType, {
          parentId: command.parentId,
          columnIndex: command.columnIndex,
          position: command.position,
        });
      } else if (command.type === 'move') {
        onMove(command.nodeId, {
          parentId: command.parentId,
          columnIndex: command.columnIndex,
          position: command.position,
        });
      } else if (command.type === 'moveToStep') {
        onMoveToStep?.(command.nodeId, command.stepId);
      }
    },
    [onInsert, onMove, onMoveToStep, reset]
  );

  const ghostLabel = useMemo(() => {
    if (!active) return '';
    if (active.kind === 'library') return active.label || active.fieldType;
    const node = tree.nodes[active.nodeId];
    return node?.config?.label || node?.config?.title || node?.type || '';
  }, [active, tree]);

  return (
    <DropTargetContext.Provider value={target}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={reset}
        autoScroll={{ threshold: { x: 0.2, y: 0.2 }, acceleration: 25, interval: 5 }}>
        {children}
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className='sf-drag-ghost'>
              <span className='sf-drag-ghost__label'>{ghostLabel}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DropTargetContext.Provider>
  );
}
