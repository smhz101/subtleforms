import { useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';
import Icon from '../../ui/Icon';
import { categoryLabel } from './FieldDock';
import { canInsertType } from './dnd/resolveDrop';

export default function FieldPickerPopover({ fieldGroups: allGroups, context, onInsert, tree, rootId }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Only the types allowed at this spot (same rules as drag and drop).
  const fieldGroups = useMemo(() => {
    if (!tree) return allGroups;
    const parentId = context?.replaceId
      ? tree.nodes[context.replaceId]?.parentId
      : context?.parentId || rootId;
    const out = {};
    Object.entries(allGroups || {}).forEach(([cat, list]) => {
      out[cat] = (list || []).filter((f) => canInsertType(tree, f.type, parentId));
    });
    return out;
  }, [allGroups, tree, context, rootId]);

  const flatSearchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const results = [];
    Object.values(fieldGroups).forEach((fields) =>
      fields.forEach((f) => {
        if (
          !f.pro_placeholder &&
          (f.label.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))
        ) {
          results.push(f);
        }
      })
    );
    return results;
  }, [query, fieldGroups]);

  const groupedFields = useMemo(() => {
    if (query.trim()) return null;
    const result = {};
    Object.entries(fieldGroups).forEach(([cat, fields]) => {
      const visible = fields.filter((f) => !f.pro_placeholder);
      if (visible.length) result[cat] = visible;
    });
    return result;
  }, [query, fieldGroups]);

  return (
    <div
      className='sf-field-picker-popover'
      role='dialog'
      aria-label={__('Add Field', 'subtleforms')}>
      {/* Search */}
      <div className='sf-field-picker-popover__search'>
        <span className='sf-field-picker-popover__search-icon' aria-hidden='true'>
          <Icon.Search size={14} />
        </span>
        <input
          ref={inputRef}
          type='text'
          className='sf-field-picker-popover__search-input'
          placeholder={__('Search fields…', 'subtleforms')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          autoFocus
          aria-label={__('Search fields', 'subtleforms')}
        />
        {query && (
          <button
            type='button'
            className='sf-field-picker-popover__search-clear'
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label={__('Clear search', 'subtleforms')}>
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <div className='sf-field-picker-popover__body'>
        {flatSearchResults !== null ? (
          flatSearchResults.length === 0 ? (
            <div className='sf-field-picker-popover__empty'>
              {__('No fields match', 'subtleforms')} &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className='sf-field-picker-popover__grid'>
              {flatSearchResults.map((f) => {
                const FieldIcon = getIcon(f.type);
                return (
                  <button
                    key={f.type}
                    type='button'
                    onClick={() => onInsert(f.type, context)}
                    className='sf-field-picker-popover__item'
                    title={f.label}>
                    <span className='sf-field-picker-popover__item-icon'>
                      <FieldIcon size={18} />
                    </span>
                    <span className='sf-field-picker-popover__item-label'>{f.label}</span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          groupedFields &&
          Object.entries(groupedFields).map(([cat, fields]) => (
            <div key={cat} className='sf-field-picker-popover__category'>
              <div className='sf-field-picker-popover__category-label'>{categoryLabel(cat)}</div>
              <div className='sf-field-picker-popover__grid'>
                {fields.map((f) => {
                  const FieldIcon = getIcon(f.type);
                  return (
                    <button
                      key={f.type}
                      type='button'
                      onClick={() => onInsert(f.type, context)}
                      className='sf-field-picker-popover__item'
                      title={f.label}>
                      <span className='sf-field-picker-popover__item-icon'>
                        <FieldIcon size={18} />
                      </span>
                      <span className='sf-field-picker-popover__item-label'>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
