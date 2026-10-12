import { useMemo, useEffect, useRef, useCallback } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useBuilder } from './context/BuilderContext';
import Icon from '../../ui/Icon';
import FieldRenderer from './FieldRenderer';
import FieldChrome from './FieldChrome';
import { nodeToField, getRootNodeId } from './utils/schemaTree';
import { questionIds } from '../../../shared/conversational';
import { fieldAppearanceClasses } from '../../../shared/appearance';
import './ConversationalCanvas.scss';

/**
 * Where a question sits in the tree: parent and index (for moves).
 */
function locate(tree, nodeId) {
  const node = tree.nodes[nodeId];
  const parent = node && tree.nodes[node.parentId];
  if (!parent) return null;
  return { parentId: parent.id, position: (parent.children || []).indexOf(nodeId), siblings: parent.children || [] };
}

/**
 * ConversationalCanvas: one question at a time (2.3.2).
 *
 * - A new form shows "Add your first question" instead of a locked block.
 * - Every question (a welcome screen too) can be selected and edited in the
 *   inspector, replaced by another field, moved earlier or later, duplicated
 *   and deleted from its toolbar.
 * - The cursor (current question, or an empty question slot) is shared with
 *   the field panel: adding a field fills an empty question, otherwise it
 *   adds a new question after the current one.
 *
 * @param {Object}   props
 * @param {Object}   props.cursor    { index, empty } current question or empty slot.
 * @param {Function} props.setCursor Cursor setter.
 */
export default function ConversationalCanvas({ cursor = { index: 0, empty: false }, setCursor = () => {} }) {
  const {
    tree,
    selectedId,
    setSelectedId,
    isReadOnly,
    actions: { onDelete, onDuplicate, onRequestInsert, onMove },
  } = useBuilder();

  const rootId = getRootNodeId();
  const ids = useMemo(() => questionIds(tree, rootId), [tree, rootId]);
  const count = ids.length;
  const isEmptySlot = cursor.empty || count === 0;
  const total = count + (cursor.empty && count > 0 ? 1 : 0);
  const index = Math.max(0, Math.min(cursor.index, isEmptySlot ? count : count - 1));
  const currentId = isEmptySlot ? null : ids[index];
  const addButtonRef = useRef(null);

  // Keep the cursor inside the list after deletes.
  useEffect(() => {
    if (!cursor.empty && count > 0 && cursor.index > count - 1) {
      setCursor({ index: count - 1, empty: false });
    }
  }, [cursor, count, setCursor]);

  // Selecting a question elsewhere (inspector, field panel, undo) shows it.
  useEffect(() => {
    if (!selectedId) return;
    const at = ids.indexOf(selectedId);
    if (at >= 0 && (at !== cursor.index || cursor.empty)) {
      setCursor({ index: at, empty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ids]);

  const go = useCallback(
    (at) => {
      if (at < 0 || at >= count) return;
      setCursor({ index: at, empty: false });
      setSelectedId(ids[at]);
    },
    [count, ids, setCursor, setSelectedId]
  );

  // Root position for a new question at question index `at`.
  const insertContext = useCallback(
    (at) => {
      const root = tree.nodes[rootId];
      const rootChildren = root?.children || [];
      if (at >= ids.length) {
        return { parentId: rootId, columnIndex: null, position: rootChildren.length };
      }
      const loc = locate(tree, ids[at]);
      return loc
        ? { parentId: loc.parentId, columnIndex: null, position: loc.position }
        : { parentId: rootId, columnIndex: null, position: null };
    },
    [tree, rootId, ids]
  );

  const openPicker = (event, context) => {
    onRequestInsert?.(context, event?.currentTarget || addButtonRef.current);
  };

  const addEmptyQuestion = () => {
    setSelectedId(null);
    setCursor({ index: count === 0 ? 0 : index + 1, empty: true });
  };

  const field = currentId ? nodeToField(tree, currentId) : null;
  const loc = currentId ? locate(tree, currentId) : null;
  const toolbarActions = currentId && loc
    ? {
        canMoveUp: index > 0,
        canMoveDown: index < count - 1,
        moveUpLabel: __('Move question earlier', 'subtleforms'),
        moveDownLabel: __('Move question later', 'subtleforms'),
        onMoveUp: () => {
          const target = locate(tree, ids[index - 1]);
          if (!target) return;
          onMove(currentId, { parentId: target.parentId, columnIndex: null, position: target.position });
          setCursor({ index: index - 1, empty: false });
        },
        onMoveDown: () => {
          const target = locate(tree, ids[index + 1]);
          if (!target) return;
          onMove(currentId, { parentId: target.parentId, columnIndex: null, position: target.position });
          setCursor({ index: index + 1, empty: false });
        },
        onDuplicate: () => onDuplicate(currentId, { parentId: loc.parentId, columnIndex: null, position: loc.position + 1 }),
        onDelete: () => {
          onDelete(currentId);
          setCursor({ index: Math.max(0, index - (index >= count - 1 ? 1 : 0)), empty: false });
        },
        onReplace: (anchor) =>
          onRequestInsert?.({ parentId: loc.parentId, columnIndex: null, position: loc.position, replaceId: currentId }, anchor),
      }
    : null;

  const progressPercent = total > 0 ? ((index + 1) / total) * 100 : 0;

  if (count === 0) {
    return (
      <div className='sf-conversational-canvas'>
        <div className='sf-conversational-canvas__content'>
          <div className='sf-conversational-canvas__empty'>
            <div className='sf-conversational-canvas__empty-icon' aria-hidden='true'>
              <Icon.MessageCircle size={32} />
            </div>
            <h3 className='sf-conversational-canvas__empty-title'>
              {__('Add your first question', 'subtleforms')}
            </h3>
            <p className='sf-conversational-canvas__empty-description'>
              {__(
                'Visitors see one question at a time. Choose a field below or click one in the panel on the left.',
                'subtleforms'
              )}
            </p>
            {!isReadOnly && (
              <Button
                ref={addButtonRef}
                variant='primary'
                icon={<Icon.Plus size={16} />}
                onClick={(e) => openPicker(e, insertContext(0))}>
                {__('Choose a field', 'subtleforms')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='sf-conversational-canvas'>
      <div className='sf-conversational-canvas__progress-header'>
        <div className='sf-conversational-canvas__progress-info'>
          <span className='sf-conversational-canvas__progress-label' aria-live='polite'>
            {sprintf(
              /* translators: 1: question number, 2: number of questions */
              __('Question %1$d of %2$d', 'subtleforms'),
              index + 1,
              total
            )}
          </span>
          <span className='sf-conversational-canvas__progress-percent'>
            {sprintf(
              /* translators: %d: percent of the form completed */
              __('%d%% complete', 'subtleforms'),
              Math.round(progressPercent)
            )}
          </span>
        </div>
        <div className='sf-conversational-canvas__progress-bar'>
          <div className='sf-conversational-canvas__progress-fill' style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className='sf-conversational-canvas__content'>
        <div className='sf-conversational-canvas__card'>
          {isEmptySlot ? (
            <div className='sf-conversational-canvas__slot'>
              <p className='sf-conversational-canvas__slot-title'>{__('Empty question', 'subtleforms')}</p>
              <p className='sf-conversational-canvas__slot-text'>
                {__('Choose a field for this question, or click one in the panel on the left.', 'subtleforms')}
              </p>
              <div className='sf-conversational-canvas__slot-actions'>
                <Button
                  variant='primary'
                  icon={<Icon.Plus size={16} />}
                  onClick={(e) => openPicker(e, insertContext(index))}>
                  {__('Choose a field', 'subtleforms')}
                </Button>
                <Button
                  variant='tertiary'
                  onClick={() => setCursor({ index: Math.max(0, index - 1), empty: false })}>
                  {__('Cancel', 'subtleforms')}
                </Button>
              </div>
            </div>
          ) : (
            field && (
              <FieldChrome
                isSelected={selectedId === currentId}
                onSelect={() => setSelectedId(currentId)}
                toolbarActions={isReadOnly ? null : toolbarActions}
                appearanceClass={fieldAppearanceClasses(field?.appearance)}>
                <FieldRenderer field={field} />
              </FieldChrome>
            )
          )}
        </div>
      </div>

      <div className='sf-conversational-canvas__navigation'>
        <Button
          variant='secondary'
          onClick={() => (cursor.empty ? setCursor({ index: Math.max(0, index - 1), empty: false }) : go(index - 1))}
          disabled={index === 0}
          className='sf-conversational-canvas__nav-button'>
          <Icon.Left className='sf-conversational-canvas__nav-icon' />
          {__('Previous', 'subtleforms')}
        </Button>

        <div className='sf-conversational-canvas__dots'>
          {ids.map((id, i) => {
            const pos = cursor.empty && i >= index ? i + 1 : i;
            return (
              <button
                key={id}
                type='button'
                onClick={() => go(i)}
                aria-label={sprintf(
                  /* translators: %d: question number */
                  __('Question %d', 'subtleforms'),
                  i + 1
                )}
                aria-current={!isEmptySlot && i === index ? 'step' : undefined}
                className={`sf-conversational-canvas__dot ${
                  !isEmptySlot && i === index
                    ? 'sf-conversational-canvas__dot--active'
                    : pos < index
                    ? 'sf-conversational-canvas__dot--completed'
                    : 'sf-conversational-canvas__dot--upcoming'
                }`}
              />
            );
          })}
        </div>

        <div className='sf-conversational-canvas__nav-end'>
          {!isReadOnly && !cursor.empty && (
            <Button
              variant='tertiary'
              icon={<Icon.Plus size={16} />}
              onClick={addEmptyQuestion}
              className='sf-conversational-canvas__add'>
              {__('Add question', 'subtleforms')}
            </Button>
          )}
          <Button
            variant='primary'
            onClick={() => go(index + 1)}
            disabled={isEmptySlot || index >= count - 1}
            className='sf-conversational-canvas__nav-button'>
            {__('Next', 'subtleforms')}
            <Icon.Right className='sf-conversational-canvas__nav-icon' />
          </Button>
        </div>
      </div>
    </div>
  );
}
