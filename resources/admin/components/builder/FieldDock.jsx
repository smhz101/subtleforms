import { useDraggable } from '@dnd-kit/core';
import { LIBRARY_PREFIX } from './dnd/BuilderDnd';
import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';
import Icon from '../../ui/Icon';
import { openUpgradeModal } from '../../utils/featureGate';

/**
 * Library section names. Keys are the PHP categories.
 */
const CATEGORY_LABELS = {
  basic: __('Basic', 'subtleforms'),
  choices: __('Choices', 'subtleforms'),
  advanced: __('Advanced', 'subtleforms'),
  media: __('Uploads', 'subtleforms'),
  layout: __('Layout', 'subtleforms'),
  payment: __('Payments', 'subtleforms'),
  system: __('Spam protection', 'subtleforms'),
  special: __('Special', 'subtleforms'),
  structure: __('Structure', 'subtleforms'),
};

export const categoryLabel = (key) =>
  CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);

function HighlightMatch({ text, query }) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className='sf-inserter__highlight'>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Field library — the left panel of the builder.
 *
 * Click (or Enter) adds a field after the current selection. Pro fields are
 * shown in place with a lock; choosing one explains what Pro unlocks rather
 * than hiding the capability.
 */
/**
 * A library tile can be clicked (adds the field to the current step or the
 * end of the form) or dragged onto the canvas, into a container or onto a
 * step tab (2.3.1). Only the pointer starts a drag, so Enter and Space keep
 * adding the field.
 */
function LibraryTile({ type, label, draggable, children, ...buttonProps }) {
  const { setNodeRef, listeners } = useDraggable({
    id: `${LIBRARY_PREFIX}${type}`,
    data: { kind: 'library', fieldType: type, label },
    disabled: !draggable,
  });
  return (
    <button
      type='button'
      ref={setNodeRef}
      {...buttonProps}
      onPointerDown={draggable ? listeners?.onPointerDown : undefined}
      data-field-type={type}>
      {children}
    </button>
  );
}

export default function FieldDock({ fieldGroups, onAddField, onCollapsedChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const searchInputRef = useRef(null);
  const clickTimerRef = useRef(null);
  const collapsedRef = useRef(collapsed);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const setCollapsedState = (next) => {
    setCollapsed(next);
    onCollapsedChange?.(next);
  };

  // A double-click fires click → click → dblclick. Queue the click behind a
  // short delay and let the double-click cancel it, so both add one field.
  const handleFieldClick = useCallback(
    (type) => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onAddField(type);
        setSearchQuery('');
      }, 200);
    },
    [onAddField]
  );

  const handleFieldDoubleClick = useCallback(
    (type) => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onAddField(type);
      setSearchQuery('');
    },
    [onAddField]
  );

  // "/" quick-add shortcut from the canvas keyboard handler.
  useEffect(() => {
    const handleQuickAdd = () => {
      if (collapsedRef.current) {
        setCollapsed(false);
        onCollapsedChange?.(false);
      }
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };
    window.addEventListener('sf:builder:quick-add', handleQuickAdd);
    return () => window.removeEventListener('sf:builder:quick-add', handleQuickAdd);
  }, [onCollapsedChange]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !fieldGroups) return null;
    const matches = [];
    Object.values(fieldGroups).forEach((fields) =>
      fields.forEach((f) => {
        const haystack = `${f.label} ${f.type} ${f.meta?.description || ''}`.toLowerCase();
        if (haystack.includes(q)) matches.push(f);
      })
    );
    return matches;
  }, [searchQuery, fieldGroups]);

  const renderTile = (f) => {
    const isDisabled = f.enabled === false;
    const isProLocked = f.is_pro_locked === true;
    const FieldIcon = getIcon(f.type);
    const description = f.meta?.description || '';

    let title = description ? `${f.label} — ${description}` : f.label;
    if (isDisabled) {
      title = __('Turn this provider on in Settings → Advanced to use it.', 'subtleforms');
    } else if (isProLocked) {
      title = sprintf(
        /* translators: %s: field name */
        __('%s is part of SubtleForms Pro', 'subtleforms'),
        f.label
      );
    }

    return (
      <LibraryTile
        key={f.type}
        type={f.type}
        label={f.label}
        draggable={!isDisabled && !isProLocked}
        className={clsx('sf-inserter__item', {
          'is-disabled': isDisabled,
          'is-locked': isProLocked,
        })}
        disabled={isDisabled}
        title={title}
        onClick={() => {
          if (isDisabled) return;
          if (isProLocked) {
            openUpgradeModal(f.category === 'payment' ? 'actions.payment' : 'fields.advanced', {
              label: f.label,
            });
            return;
          }
          handleFieldClick(f.type);
        }}
        onDoubleClick={() => {
          if (isDisabled || isProLocked) return;
          handleFieldDoubleClick(f.type);
        }}>
        <span className='sf-inserter__item-icon' aria-hidden='true'>
          <FieldIcon size={20} />
        </span>
        <span className='sf-inserter__item-label'>
          <HighlightMatch text={f.label} query={searchQuery} />
        </span>
        {isProLocked && (
          <span className='sf-inserter__item-pro'>{__('Pro', 'subtleforms')}</span>
        )}
      </LibraryTile>
    );
  };

  if (collapsed) {
    return (
      <div className='sf-inserter sf-inserter--collapsed'>
        <Button
          className='sf-inserter__expand'
          icon={<Icon.Plus size={20} />}
          label={__('Show field library', 'subtleforms')}
          showTooltip
          tooltipPosition='middle right'
          onClick={() => setCollapsedState(false)}
        />
      </div>
    );
  }

  if (!fieldGroups || Object.keys(fieldGroups).length === 0) {
    return (
      <div className='sf-inserter sf-inserter--loading'>
        <div className='sf-inserter__loading'>
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className='sf-inserter__skeleton' />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className='sf-inserter'>
        <div className='sf-inserter__header'>
          <h2 className='sf-inserter__title'>{__('Add field', 'subtleforms')}</h2>
          <Button
            className='sf-inserter__collapse'
            icon={<Icon.ChevronLeft size={18} />}
            label={__('Hide field library', 'subtleforms')}
            showTooltip
            onClick={() => setCollapsedState(true)}
          />
        </div>

        <div className='sf-inserter__search'>
          <Icon.Search size={16} className='sf-inserter__search-icon' aria-hidden='true' />
          <input
            ref={searchInputRef}
            type='search'
            className='sf-inserter__search-input'
            placeholder={__('Search fields', 'subtleforms')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                e.currentTarget.blur();
              }
              if (e.key === 'Enter' && searchResults?.length === 1) {
                const only = searchResults[0];
                if (only.enabled !== false && !only.is_pro_locked) {
                  onAddField(only.type);
                  setSearchQuery('');
                }
              }
            }}
            aria-label={__('Search fields', 'subtleforms')}
          />
          <kbd className='sf-inserter__search-kbd' aria-hidden='true'>/</kbd>
        </div>

        <div className='sf-inserter__content'>
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <div className='sf-inserter__empty'>
                <Icon.Search size={20} aria-hidden='true' />
                <p>
                  {sprintf(
                    /* translators: %s: search query */
                    __('No fields match “%s”.', 'subtleforms'),
                    searchQuery
                  )}
                </p>
              </div>
            ) : (
              <section className='sf-inserter__section'>
                <h3 className='sf-inserter__section-title'>
                  {__('Results', 'subtleforms')}
                </h3>
                <div className='sf-inserter__grid'>{searchResults.map(renderTile)}</div>
              </section>
            )
          ) : (
            Object.entries(fieldGroups).map(([category, fields]) => {
              const isGroupCollapsed = !!collapsedGroups[category];
              return (
                <section key={category} className='sf-inserter__section'>
                  <button
                    type='button'
                    className='sf-inserter__section-toggle'
                    aria-expanded={!isGroupCollapsed}
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [category]: !prev[category],
                      }))
                    }>
                    <span className='sf-inserter__section-title'>
                      {categoryLabel(category)}
                    </span>
                    <Icon.ChevronDown
                      size={16}
                      className={clsx('sf-inserter__section-chevron', {
                        'is-collapsed': isGroupCollapsed,
                      })}
                      aria-hidden='true'
                    />
                  </button>
                  {!isGroupCollapsed && (
                    <div className='sf-inserter__grid'>{fields.map(renderTile)}</div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

    </>
  );
}
