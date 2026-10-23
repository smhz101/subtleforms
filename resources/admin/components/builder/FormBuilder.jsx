import { memo, useMemo, useCallback, useEffect, useState, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { useDndMonitor } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import Icon from '../../ui/Icon';
import {
  formAppearanceStyle,
  formAppearanceClasses,
  fieldAppearanceStyle,
  fieldAppearanceClasses,
  appearanceBackdrop,
} from '../../../shared/appearance';
import { useThemeStyles, injectThemeStyles, themeSurfaceStyle, THEME_SCOPE_CLASS } from '../../data/themeStyles';
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
import { moveTargets } from './dnd/resolveDrop';
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

function containerToolbarActions({
  tree,
  node,
  nodeId,
  parentId,
  columnIndex,
  position,
  onMove,
  onDelete,
  onDuplicate,
  onUpdate,
  fieldDefinitions,
}) {
  const siblings = nodeChildren(tree, parentId, columnIndex);
  const canMoveUp = position > 0;
  const canMoveDown = position < siblings.length - 1;
  return {
    canMoveUp,
    canMoveDown,
    onMoveUp: canMoveUp
      ? () => onMove(nodeId, { parentId, columnIndex, position: position - 1 })
      : null,
    onMoveDown: canMoveDown
      ? () => onMove(nodeId, { parentId, columnIndex, position: position + 1 })
      : null,
    onDuplicate: () => onDuplicate(nodeId, { parentId, columnIndex, position: position + 1 }),
    onDelete: () => onDelete(nodeId),
    moveTargets: moveTargets(tree, nodeId, {
      top: __('Top level', 'subtleforms'),
      /* translators: %d: column number */
      column: __('column %d', 'subtleforms'),
      ...Object.fromEntries(
        Object.entries(fieldDefinitions || {}).map(([type, def]) => [type, def?.label || type])
      ),
    }),
    onMoveTo: (destination) => onMove(nodeId, { ...destination, position: null }),
    width: node.config?.appearance?.width || '',
    onWidthChange: typeof onUpdate === 'function'
      ? (w) => {
          const next = { ...(node.config?.appearance || {}) };
          if (w) {
            next.width = w;
          } else {
            delete next.width;
          }
          onUpdate(nodeId, { appearance: next });
        }
      : null,
  };
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
      kind: 'node',
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
 * FieldNode, memoized wrapper for a single leaf field on the canvas.
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
  const { actions: builderActions, fieldDefinitions } = useBuilder();

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
    // Keyboard-friendly alternative to dragging into and out of containers.
    moveTargets: moveTargets(tree, nodeId, {
      top: __('Top level', 'subtleforms'),
      /* translators: %d: column number */
      column: __('column %d', 'subtleforms'),
      ...Object.fromEntries(
        Object.entries(fieldDefinitions || {}).map(([type, def]) => [type, def?.label || type])
      ),
    }),
    onMoveTo: (destination) => onMove(nodeId, { ...destination, position: null }),
    width: field?.appearance?.width || '',
    onWidthChange: builderActions?.onUpdate
      ? (w) => {
          const next = { ...(field?.appearance || {}) };
          if (w) next.width = w; else delete next.width;
          builderActions.onUpdate(nodeId, { appearance: next });
        }
      : null,
  }), [canMoveUp, canMoveDown, nodeId, parentId, columnIndex, position, onMove, onDuplicate, onDelete, field, builderActions, tree, fieldDefinitions]);

  // Colour, type and shape overrides as custom properties; width and spacing
  // are applied by the drop zone wrapper.
  const fieldStyleVars = useMemo(() => {
    const s = fieldAppearanceStyle(field?.appearance);
    delete s.flexBasis;
    delete s.maxWidth;
    delete s.marginTop;
    delete s.marginBottom;
    return s;
  }, [field]);

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
            appearanceStyle={fieldStyleVars}
            appearanceClass={fieldAppearanceClasses(field?.appearance)}
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

export default function FormBuilder({ appearance } = {}) {
  // Get all state from context (including validationErrorsByFieldKey)
  const {
    tree,
    selectedId,
    selectedStepId,
    setSelectedId,
    fieldDefinitions,
    actions: { onMove, onDelete, onDuplicate, onRequestInsert, onUpdate },
    validationErrors,
    validationErrorsByFieldKey: validationErrorsByFieldKeyFromContext,
  } = useBuilder();

  const [previewValidation, setPreviewValidation] = useState(false);

  // Multi-select: shift-click accumulates node IDs; bulk ops act on this set
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedIdsRef = useRef([]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // O(1) Set lookup, avoids O(n) .includes() per FieldNode in renderNode (Task 7: memo perf)
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Sync selectedIds with tree, prune stale IDs after undo/redo or cascading parent deletes (Task 3)
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
      // Guard first, never steal keys from inputs
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
          // Only delete top-level nodes, parent deletion cascades to children
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

  // Drags are handled by the builder-wide drag context (dnd/BuilderDnd);
  // starting one clears the multi-selection.
  useDndMonitor({
    onDragStart: () => setSelectedIds([]),
  });

  // The canvas wears the form's Appearance (colours, type, radius, input and
  // button styles) so every styling change is visible while building.
  // A theme form is drawn with the theme's own fonts and colours (2.7.2), the
  // same ones the site prints, so the canvas matches the page.
  const theme = useThemeStyles();
  const isThemeForm = appearance?.preset === 'theme';
  useEffect(() => {
    if (isThemeForm && theme) {
      injectThemeStyles(theme);
    }
  }, [isThemeForm, theme]);

  const canvasStyle = useMemo(() => {
    const style = formAppearanceStyle(appearance);
    delete style.maxWidth;
    delete style.marginLeft;
    delete style.marginRight;
    const backdrop = appearanceBackdrop(appearance);
    if (backdrop) {
      style.background = backdrop;
    }
    if (isThemeForm && theme) {
      const surface = themeSurfaceStyle(theme);
      const tokens = appearance?.tokens || {};
      if (surface.fontFamily && !(tokens.fontFamily && tokens.fontFamily !== 'inherit')) {
        style.fontFamily = surface.fontFamily;
      }
      if (surface.color && !tokens.colorText) {
        style['--subtleforms-color-text'] = surface.color;
      }
      if (surface.backgroundColor && (!tokens.colorBackground || tokens.colorBackground === 'transparent')) {
        style.backgroundColor = surface.backgroundColor;
      }
    }
    return style;
  }, [appearance, isThemeForm, theme]);

  // Field width/spacing live on the wrapper that holds the field and its
  // insert line, so narrow fields sit side by side like on the page.
  const getItemStyle = useCallback((itemId) => {
    const a = tree.nodes[itemId]?.config?.appearance;
    if (!a) return undefined;
    const style = {};
    if (a.width && a.width !== '100') {
      const pct = Number(a.width);
      style.flex = `0 0 calc(${pct}% - var(--dropzone-gap) * ${(100 - pct) / 100})`;
    }
    if (a.marginTop) style.marginTop = a.marginTop;
    if (a.marginBottom) style.marginBottom = a.marginBottom;
    return style;
  }, [tree]);

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
                toolbarActions={
                  node.type === 'step'
                    ? null
                    : containerToolbarActions({
                        tree,
                        node,
                        nodeId,
                        parentId,
                        columnIndex: parentColumnIndex,
                        position,
                        onMove,
                        onDelete,
                        onDuplicate,
                        onUpdate,
                        fieldDefinitions,
                      })
                }
                renderColumn={(columnChildren, colIndex) => (
                  <ColumnDropZone
                    key={`${nodeId}-${colIndex}`}
                    containerId={nodeId}
                    columnIndex={isColumnContainer(node) ? colIndex : null}
                    items={columnChildren}
                    onRequestInsert={onRequestInsert}
                    getItemStyle={getItemStyle}
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
      <div
        className={clsx('subtleforms-builder-canvas__surface', 'sf-canvas-styled', formAppearanceClasses(appearance), isThemeForm && THEME_SCOPE_CLASS)}
        style={canvasStyle}>          <div className='subtleforms-builder-canvas__toolbar'>
            <button
              type='button'
              className={`sf-preview-toggle${previewValidation ? ' sf-preview-toggle--active' : ''}`}
              aria-pressed={previewValidation}
              title={__('Show how required and format errors look to visitors', 'subtleforms')}
              onClick={(e) => { e.stopPropagation(); setPreviewValidation((v) => !v); }}>
              <Icon.ShieldCheck size={14} aria-hidden='true' />
              {previewValidation ? __('Hide validation', 'subtleforms') : __('Test validation', 'subtleforms')}
            </button>
          </div>          {isMultiStepForm && activeStep ? (
            /* Multi-step form: Show step-scoped canvas */
            <StepCanvas
              stepId={selectedStepId}
              stepNumber={stepNodes.indexOf(selectedStepId) + 1}
              totalSteps={stepNodes.length}
              renderNode={renderNode}
              getItemStyle={getItemStyle}
            />
          ) : (
            /* Regular form: Show all fields */
            <ColumnDropZone
              containerId={rootId}
              columnIndex={null}
              items={rootChildren}
              onRequestInsert={onRequestInsert}
              getItemStyle={getItemStyle}
              spacing={24}
              renderItem={(nodeId, index) =>
                renderNode(nodeId, rootId, null, index)
              }
            />
          )}
      </div>
    </div>
  );
}
