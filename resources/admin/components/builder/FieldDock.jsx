import { useState, useMemo, useRef } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

function HighlightMatch({ text, query }) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className='sf-field-dock__search-highlight'>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * FieldDock
 * UI polish only: spacing, depth, motion, affordances.
 */
export default function FieldDock({
  fieldGroups,
  onAddField,
  onCollapsedChange,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  const handleToggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsed);
    }
  };
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const toggleGroup = (category) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Flat list of all fields matching the live search query (null = no search active)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !fieldGroups) return null;
    const matches = [];
    Object.values(fieldGroups).forEach((fields) =>
      fields.forEach((f) => {
        if (
          f.label.toLowerCase().includes(q) ||
          f.type.toLowerCase().includes(q)
        ) {
          matches.push(f);
        }
      })
    );
    return matches;
  }, [searchQuery, fieldGroups]);

  if (!fieldGroups || Object.keys(fieldGroups).length === 0) {
    return (
      <div
        className='sf-field-dock sf-field-dock--loading'
        style={{ width: collapsed ? '48px' : '320px' }}>
        <div className='sf-field-dock__loading-message'>
          <p className='sf-field-dock__loading-text'>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className='sf-field-dock'
      style={{ width: collapsed ? '48px' : '320px' }}>
      {/* Header */}
      <div
        className={`sf-field-dock__header${
          !collapsed ? ' sf-field-dock__header--with-search' : ''
        }`}>
        {!collapsed && (
          <h3 className='sf-field-dock__title'>
            {__('Fields', 'subtleforms')}
          </h3>
        )}

        <Button
          isSmall
          onClick={handleToggleCollapsed}
          className='sf-field-dock__toggle-button'
          title={
            collapsed
              ? __('Expand', 'subtleforms')
              : __('Collapse', 'subtleforms')
          }>
          {collapsed ? '→' : '←'}
        </Button>
      </div>

      {/* Search bar */}
      {!collapsed && (
        <div className='sf-field-dock__search'>
          <span className='sf-field-dock__search-icon' aria-hidden='true'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none'
              stroke='currentColor' strokeWidth='2.5'
              strokeLinecap='round' strokeLinejoin='round'>
              <circle cx='11' cy='11' r='8' />
              <line x1='21' y1='21' x2='16.65' y2='16.65' />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type='text'
            className='sf-field-dock__search-input'
            placeholder={__('Search fields…', 'subtleforms')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={__('Search fields', 'subtleforms')}
          />
          {searchQuery && (
            <button
              type='button'
              className='sf-field-dock__search-clear'
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label={__('Clear search', 'subtleforms')}>
              ×
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        <div className='sf-field-dock__content'>
          {/* ── Search results view ── */}
          {searchResults !== null && (
            <>
              {searchResults.length === 0 ? (
                <div className='sf-field-dock__no-results'>
                  <span className='sf-field-dock__no-results-icon'>⊘</span>
                  <p className='sf-field-dock__no-results-text'>
                    {__('No fields match', 'subtleforms')}{' '}
                    <strong>"{searchQuery}"</strong>
                  </p>
                </div>
              ) : (
                <div className='sf-field-dock__fields-grid sf-field-dock__fields-grid--search'>
                  {searchResults.map((f) => {
                    const isDisabled = f.enabled === false;
                    return (
                      <button
                        key={f.type}
                        type='button'
                        onClick={() => !isDisabled && onAddField(f.type)}
                        disabled={isDisabled}
                        className={`sf-field-dock__field-button ${
                          isDisabled ? 'sf-field-dock__field-button--disabled' : ''
                        }`}
                        title={
                          isDisabled
                            ? __('Enable this CAPTCHA provider in Settings to use it', 'subtleforms')
                            : f.label
                        }>
                        <span className='sf-field-dock__field-icon-wrapper'>
                          <span className='sf-field-dock__field-icon'>
                            {(() => {
                              const IconComponent = getIcon(f.type);
                              return <IconComponent size={20} />;
                            })()}
                          </span>
                        </span>
                        <span className='sf-field-dock__field-label'>
                          <HighlightMatch text={f.label} query={searchQuery} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Normal grouped view ── */}
          {searchResults === null && Object.entries(fieldGroups).map(([category, categoryFields]) => {
            const isCollapsed = collapsedGroups[category];

            return (
              <div key={category} className='sf-field-dock__category'>
                {/* Category */}
                <button
                  type='button'
                  onClick={() => toggleGroup(category)}
                  className={`sf-field-dock__category-header ${
                    isCollapsed
                      ? 'sf-field-dock__category-header--collapsed'
                      : ''
                  }`}>
                  <span className='sf-field-dock__category-name'>
                    {category}
                  </span>

                  <span
                    className={`sf-field-dock__category-icon ${
                      isCollapsed
                        ? 'sf-field-dock__category-icon--collapsed'
                        : 'sf-field-dock__category-icon--expanded'
                    }`}>
                    ▼
                  </span>
                </button>

                {/* Fields */}
                {!isCollapsed && (
                  <div className='sf-field-dock__fields-grid'>
                    {categoryFields.map((f) => {
                      const isDisabled = f.enabled === false;

                      return (
                        <button
                          key={f.type}
                          type='button'
                          onClick={() => !isDisabled && onAddField(f.type)}
                          disabled={isDisabled}
                          className={`sf-field-dock__field-button ${
                            isDisabled
                              ? 'sf-field-dock__field-button--disabled'
                              : ''
                          }`}
                          title={
                            isDisabled
                              ? __(
                                  'Enable this CAPTCHA provider in Settings to use it',
                                  'subtleforms'
                                )
                              : f.label
                          }>
                          <span className='sf-field-dock__field-icon-wrapper'>
                            <span className='sf-field-dock__field-icon'>
                              {(() => {
                                const IconComponent = getIcon(f.type);
                                return <IconComponent size={20} />;
                              })()}
                            </span>
                          </span>

                          <span className='sf-field-dock__field-label'>
                            {f.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
