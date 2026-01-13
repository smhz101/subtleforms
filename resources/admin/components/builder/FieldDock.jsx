import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

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

  if (!fieldGroups || Object.keys(fieldGroups).length === 0) {
    return (
      <div
        className='sf-field-dock sf-field-dock--loading'
        style={{ width: collapsed ? '48px' : '280px' }}>
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
      style={{ width: collapsed ? '48px' : '280px' }}>
      {/* Header */}
      <div className='sf-field-dock__header'>
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

      {/* Content */}
      {!collapsed && (
        <div className='sf-field-dock__content'>
          {Object.entries(fieldGroups).map(([category, categoryFields]) => {
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
                    {categoryFields.map((f) => (
                      <button
                        key={f.type}
                        type='button'
                        onClick={() => onAddField(f.type)}
                        className='sf-field-dock__field-button'>
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
                    ))}
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
