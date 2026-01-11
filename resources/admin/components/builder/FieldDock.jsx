import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

/**
 * FieldDock
 * UI polish only: spacing, depth, motion, affordances.
 */
export default function FieldDock({ fieldGroups, onAddField }) {
  const [collapsed, setCollapsed] = useState(false);
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
        className={`
          sf-field-dock sf-field-dock--loading
          sf-flex sf-flex-col sf-h-full
          sf-bg-gray-50
          sf-border-r sf-border-gray-200
          sf-transition-all sf-duration-200 sf-ease-out
        `}
        style={{ width: collapsed ? '48px' : '280px' }}>
        <div className='sf-bg-white sf-px-4 sf-py-3 sf-border-gray-200 sf-border-b sf-field-dock__loading-message'>
          <p className='sf-m-0 sf-text-gray-500 sf-text-xs sf-field-dock__loading-text'>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        sf-field-dock
        sf-flex sf-flex-col sf-h-full
        sf-bg-gray-50
        sf-border-r sf-border-gray-200
        sf-transition-all sf-duration-200 sf-ease-out
      `}
      style={{ width: collapsed ? '48px' : '280px' }}>
      {/* Header */}
      <div
        className={`
          sf-field-dock__header
          sf-flex sf-items-center sf-justify-between
          sf-bg-white
          sf-px-4 sf-py-3
          sf-border-b sf-border-gray-200
          sf-shadow-sm
        `}>
        {!collapsed && (
          <h3 className='sf-m-0 sf-font-semibold sf-text-gray-800 sf-text-xs sf-uppercase sf-tracking-wider sf-field-dock__title'>
            {__('Fields', 'subtleforms')}
          </h3>
        )}

        <Button
          isSmall
          onClick={() => setCollapsed(!collapsed)}
          className='sf-px-2 sf-py-1 sf-min-w-0 sf-text-gray-600 hover:sf-text-gray-900 sf-field-dock__toggle-button'
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
        <div className='sf-flex-1 sf-px-3 sf-py-4 sf-overflow-auto sf-field-dock__content'>
          {Object.entries(fieldGroups).map(([category, categoryFields]) => {
            const isCollapsed = collapsedGroups[category];

            return (
              <div key={category} className='sf-mb-5 sf-field-dock__category'>
                {/* Category */}
                <button
                  type='button'
                  onClick={() => toggleGroup(category)}
                  className={`
                    sf-field-dock__category-header
                    sf-border sf-border-slate-300
                    sf-flex sf-items-center sf-justify-between
                    sf-w-full sf-p-2
                    sf-rounded-md
                    sf-bg-transparent
                    sf-transition-colors sf-duration-150
                    hover:sf-bg-gray-100
                    focus:sf-outline-none
                  `}>
                  <span className='sf-font-semibold sf-text-[11px] sf-text-gray-600 sf-uppercase sf-tracking-wide sf-field-dock__category-name'>
                    {category}
                  </span>

                  <span
                    className={`
                      sf-field-dock__category-icon
                      sf-text-[10px] sf-text-gray-500
                      sf-transition-transform sf-duration-200
                      ${isCollapsed ? '-sf-rotate-90' : 'sf-rotate-0'}
                    `}>
                    ▼
                  </span>
                </button>

                {/* Fields */}
                {!isCollapsed && (
                  <div className='sf-gap-2 sf-field-dock__fields-grid sf-grid sf-grid-cols-2 sf-mt-3'>
                    {categoryFields.map((f) => (
                      <button
                        key={f.type}
                        type='button'
                        onClick={() => onAddField(f.type)}
                        className={`
                          sf-field-dock__field-button
                          sf-group
                          sf-flex sf-flex-row sf-items-center sf-justify-center
                          sf-gap-2
                          sf-px-2 sf-py-3
                          sf-rounded-xl
                          sf-bg-white
                          sf-border sf-border-gray-200
                          sf-transition-all sf-duration-200 sf-ease-out
                          hover:sf-border-blue-500
                          hover:sf-shadow-md
                          hover:sf-bg-blue-50
                          active:sf-scale-[0.98]
                          focus:sf-outline-none focus-visible:sf-ring-2 focus-visible:sf-ring-blue-500 focus-visible:sf-ring-offset-1
                          sf-text-center
                        `}>
                        <span className='sf-flex sf-justify-center sf-items-center sf-bg-gray-50 group-hover:sf-bg-blue-100 sf-rounded-lg sf-w-10 sf-h-10 sf-transition-colors sf-field-dock__field-icon-wrapper'>
                          <span className='sf-text-gray-600 group-hover:sf-text-blue-600 sf-transition-colors sf-field-dock__field-icon'>
                            {(() => {
                              const IconComponent = getIcon(f.type);
                              return <IconComponent size={20} />;
                            })()}
                          </span>
                        </span>

                        <span className='sf-font-medium sf-text-gray-800 sf-text-xs sf-leading-tight sf-field-dock__field-label'>
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
