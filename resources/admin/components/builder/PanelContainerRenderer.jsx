import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import { useEffect, useState } from '@wordpress/element';
import Icon from '../../ui/Icon';
import { getIcon } from './utils/iconMap';
import { useBuilder } from './context/BuilderContext';
import { PANEL_OF } from '../../../shared/panels';
import FieldToolbar from './FieldToolbar';
import './ContainerRenderer.scss';
import './PanelContainerRenderer.scss';

/**
 * Canvas chrome for Tabs and Accordion (2.9.0).
 *
 * Tabs draw a real tab strip, an Accordion stacks its sections. Either way
 * one panel is open at a time in the builder, the one that is selected (or
 * holds the selected field), so authors can drop fields into it. Closed
 * panels are not drawn here; the live form keeps them all mounted.
 *
 * Panels are selected like any other node (the title, key and logic are in
 * the inspector). The container's own header selects the container.
 */
export default function PanelContainerRenderer({
  node,
  isSelected,
  onSelect,
  onDelete,
  renderPanelBody,
  dragHandleRef,
  dragHandleListeners,
  toolbarActions = null,
}) {
  const { tree, selectedId, setSelectedId, actions, isReadOnly } = useBuilder();
  const isTabs = node.type === 'tabs_container';
  const panelType = PANEL_OF[node.type];
  const panelIds = (node.children || []).filter((id) => tree.nodes[id]?.type === panelType);
  const startIndex = Math.max(0, Math.min(parseInt(node.config?.active, 10) || 0, panelIds.length - 1));

  const [openId, setOpenId] = useState(panelIds[startIndex] || null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Keep a panel open: the one that holds the selection, else the first.
  useEffect(() => {
    let current = tree.nodes[selectedId];
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.parentId === node.id && panelIds.includes(current.id)) {
        setOpenId(current.id);
        return;
      }
      current = current.parentId ? tree.nodes[current.parentId] : null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  useEffect(() => {
    if (!openId || !panelIds.includes(openId)) {
      setOpenId(panelIds[startIndex] || panelIds[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelIds.join('|')]);

  const title = node.config?.label || (isTabs ? __('Tabs', 'subtleforms') : __('Accordion', 'subtleforms'));
  const NodeIcon = getIcon(node.type);
  const showToolbar = !!toolbarActions && (isSelected || isHovered || isFocused);
  const canAdd = !isReadOnly && typeof actions.onAddPanel === 'function';
  const canRemove = !isReadOnly && panelIds.length > 1 && typeof actions.onDeletePanel === 'function';

  const { onPointerDown, onMouseDown, onTouchStart, ...handleRest } = dragHandleListeners || {};
  const stopThen = (fn) => (event) => {
    event.stopPropagation();
    if (typeof fn === 'function') fn(event);
  };

  const panelTitle = (id) =>
    tree.nodes[id]?.config?.label ||
    (isTabs ? __('Untitled tab', 'subtleforms') : __('Untitled section', 'subtleforms'));

  const choose = (id) => (event) => {
    event.stopPropagation();
    setOpenId(id);
    setSelectedId(id);
  };

  const movePanel = (id, delta) => (event) => {
    event.stopPropagation();
    const index = panelIds.indexOf(id);
    const next = index + delta;
    if (next < 0 || next >= panelIds.length) return;
    actions.onMove?.(id, { parentId: node.id, columnIndex: null, position: next });
  };

  const renderPanelControls = (id) => {
    const index = panelIds.indexOf(id);
    if (selectedId !== id || isReadOnly) return null;
    return (
      <span className='sf-panel-container__controls'>
        <button
          type='button'
          className='sf-panel-container__icon-button'
          aria-label={isTabs ? __('Move tab earlier', 'subtleforms') : __('Move section up', 'subtleforms')}
          disabled={index <= 0}
          onClick={movePanel(id, -1)}>
          {isTabs ? <Icon.ChevronLeft size={14} /> : <Icon.ChevronUp size={14} />}
        </button>
        <button
          type='button'
          className='sf-panel-container__icon-button'
          aria-label={isTabs ? __('Move tab later', 'subtleforms') : __('Move section down', 'subtleforms')}
          disabled={index >= panelIds.length - 1}
          onClick={movePanel(id, 1)}>
          {isTabs ? <Icon.ChevronRight size={14} /> : <Icon.ChevronDown size={14} />}
        </button>
        {canRemove ? (
          <button
            type='button'
            className='sf-panel-container__icon-button sf-panel-container__icon-button--danger'
            aria-label={
              isTabs ? __('Delete this tab', 'subtleforms') : __('Delete this section', 'subtleforms')
            }
            onClick={(event) => {
              event.stopPropagation();
              actions.onDeletePanel(id);
            }}>
            <Icon.Trash size={14} />
          </button>
        ) : null}
      </span>
    );
  };

  const addButton = canAdd ? (
    <button
      type='button'
      className='sf-panel-container__add'
      onClick={(event) => {
        event.stopPropagation();
        actions.onAddPanel(node.id);
      }}>
      <Icon.Plus size={14} aria-hidden='true' />
      {isTabs ? __('Add tab', 'subtleforms') : __('Add section', 'subtleforms')}
    </button>
  ) : null;

  return (
    <div
      className={clsx('sf-container-renderer', 'sf-panel-container', {
        'is-selected': isSelected,
        'sf-panel-container--tabs': isTabs,
        'sf-panel-container--accordion': !isTabs,
      })}
      data-node-id={node.id}
      tabIndex={0}
      role='group'
      aria-label={sprintf(
        /* translators: %s: container name */
        __('%s container. Press Enter to select.', 'subtleforms'),
        title
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }
      }}>
      <div className='sf-container-renderer__header'>
        <div className='sf-container-renderer__header-left'>
          {dragHandleRef && (
            <button
              type='button'
              ref={dragHandleRef}
              {...handleRest}
              onPointerDown={stopThen(onPointerDown)}
              onMouseDown={stopThen(onMouseDown)}
              onTouchStart={stopThen(onTouchStart)}
              onClick={(event) => event.stopPropagation()}
              aria-label={__('Drag container', 'subtleforms')}
              className='sf-container-renderer__handle'>
              <Icon.Move size={16} />
            </button>
          )}
          <NodeIcon size={18} aria-hidden='true' />
          <div className='sf-container-renderer__header-title'>
            <strong>{title}</strong>
          </div>
        </div>
        {!toolbarActions && (
          <button
            type='button'
            className='sf-container-renderer__delete'
            aria-label={__('Delete container', 'subtleforms')}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}>
            <Icon.Trash size={14} />
          </button>
        )}
      </div>
      {showToolbar && (
        <FieldToolbar
          visible
          onMoveUp={toolbarActions.onMoveUp}
          onMoveDown={toolbarActions.onMoveDown}
          onDuplicate={toolbarActions.onDuplicate}
          onDelete={toolbarActions.onDelete}
          canMoveUp={toolbarActions.canMoveUp}
          canMoveDown={toolbarActions.canMoveDown}
          width={toolbarActions.width}
          onWidthChange={toolbarActions.onWidthChange}
          moveTargets={toolbarActions.moveTargets}
          onMoveTo={toolbarActions.onMoveTo}
        />
      )}

      <div className='sf-container-renderer__body sf-panel-container__body'>
        {isTabs ? (
          <>
            <div className='sf-panel-container__strip'>
              <div role='tablist' aria-label={title} className='sf-panel-container__tabs'>
                {panelIds.map((id) => (
                  <span key={id} className={clsx('sf-panel-container__tab-wrap', { 'is-open': id === openId })}>
                    <button
                      type='button'
                      role='tab'
                      aria-selected={id === openId}
                      className={clsx('sf-panel-container__tab', {
                        'is-open': id === openId,
                        'is-selected': selectedId === id,
                      })}
                      onClick={choose(id)}>
                      {panelTitle(id)}
                    </button>
                    {renderPanelControls(id)}
                  </span>
                ))}
              </div>
              {addButton}
            </div>
            <div className='sf-panel-container__panel' role='tabpanel'>
              {openId ? renderPanelBody(openId) : null}
            </div>
          </>
        ) : (
          <div className='sf-panel-container__sections'>
            {panelIds.map((id) => {
              const open = id === openId;
              return (
                <div key={id} className={clsx('sf-panel-container__section', { 'is-open': open })}>
                  <div className='sf-panel-container__section-head'>
                    <button
                      type='button'
                      className={clsx('sf-panel-container__section-trigger', { 'is-selected': selectedId === id })}
                      aria-expanded={open}
                      onClick={choose(id)}>
                      <span>{panelTitle(id)}</span>
                      <Icon.ChevronDown size={16} aria-hidden='true' className='sf-panel-container__chevron' />
                    </button>
                    {renderPanelControls(id)}
                  </div>
                  {open ? <div className='sf-panel-container__panel'>{renderPanelBody(id)}</div> : null}
                </div>
              );
            })}
            {addButton}
          </div>
        )}
      </div>
    </div>
  );
}
