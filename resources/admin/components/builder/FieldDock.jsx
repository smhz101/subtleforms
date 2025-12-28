import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

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
        className='sf-flex sf-flex-col sf-bg-gray-50 sf-border-gray-300 sf-border-r sf-transition-all sf-duration-200'
        style={{ width: collapsed ? '48px' : '280px' }}>
        <div className='sf-bg-white sf-px-4 sf-py-3 sf-border-gray-300 sf-border-b'>
          <p className='sf-m-0 sf-text-gray-500 sf-text-xs'>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className='sf-flex sf-flex-col sf-bg-gray-50 sf-border-gray-300 sf-border-r sf-h-full sf-transition-all sf-duration-200'
      style={{ width: collapsed ? '48px' : '280px' }}>
      {/* Sticky Header */}
      <div className='sf-flex sf-flex-shrink-0 sf-justify-between sf-items-center sf-bg-white sf-px-4 sf-py-3 sf-border-gray-300 sf-border-b'>
        {!collapsed && (
          <h3 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-sm sf-uppercase sf-tracking-wide'>
            {__('Fields', 'subtleforms')}
          </h3>
        )}
        <Button
          isSmall
          onClick={() => setCollapsed(!collapsed)}
          className='sf-px-2 sf-py-1 sf-min-w-0'
          title={
            collapsed
              ? __('Expand', 'subtleforms')
              : __('Collapse', 'subtleforms')
          }>
          {collapsed ? '→' : '←'}
        </Button>
      </div>

      {/* Scrollable Content */}
      {!collapsed && (
        <div className='sf-flex-1 sf-px-3 sf-py-4 sf-overflow-auto'>
          {Object.entries(fieldGroups).map(([category, categoryFields]) => {
            const isCollapsed = collapsedGroups[category];
            return (
              <div key={category} className='sf-mb-4'>
                {/* Category Header */}
                <button
                  type='button'
                  onClick={() => toggleGroup(category)}
                  className='sf-flex sf-justify-between sf-items-center sf-bg-transparent sf-mb-2 sf-p-2 sf-border-none sf-outline-none sf-w-full sf-cursor-pointer'>
                  <span className='sf-font-semibold sf-text-gray-600 sf-text-xs sf-uppercase sf-tracking-wide'>
                    {category}
                  </span>
                  <span
                    className='sf-text-[10px] sf-text-gray-500 sf-transition-transform sf-duration-200'
                    style={{
                      transform: isCollapsed
                        ? 'rotate(-90deg)'
                        : 'rotate(0deg)',
                    }}>
                    ▼
                  </span>
                </button>

                {/* Field Cards */}
                {!isCollapsed && (
                  <div className='sf-gap-2 sf-grid sf-grid-cols-2'>
                    {categoryFields.map((f) => (
                      <button
                        key={f.type}
                        type='button'
                        onClick={() => onAddField(f.type)}
                        className='sf-flex sf-flex-col sf-justify-center sf-items-center sf-gap-1.5 sf-bg-white hover:sf-bg-gray-50 sf-px-2 sf-py-3 sf-border sf-border-gray-300 hover:sf-border-blue-600 sf-outline-none sf-min-h-[70px] sf-transition-all sf-duration-150 sf-cursor-pointer'>
                        <span className='sf-flex sf-text-gray-600 sf-text-xl'>
                          {(() => {
                            const IconComponent = getIcon(f.type);
                            return <IconComponent />;
                          })()}
                        </span>
                        <span className='sf-font-medium sf-text-[11px] sf-text-gray-900 sf-text-center sf-break-words sf-leading-tight'>
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
