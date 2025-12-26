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
        className='flex flex-col bg-gray-50 border-gray-300 border-r transition-all duration-200'
        style={{ width: collapsed ? '48px' : '280px' }}>
        <div className='bg-white px-4 py-3 border-gray-300 border-b'>
          <p className='m-0 text-gray-500 text-xs'>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className='flex flex-col bg-gray-50 border-gray-300 border-r h-full transition-all duration-200'
      style={{ width: collapsed ? '48px' : '280px' }}>
      {/* Sticky Header */}
      <div className='flex flex-shrink-0 justify-between items-center bg-white px-4 py-3 border-gray-300 border-b'>
        {!collapsed && (
          <h3 className='m-0 font-semibold text-gray-900 text-sm uppercase tracking-wide'>
            {__('Fields', 'subtleforms')}
          </h3>
        )}
        <Button
          isSmall
          onClick={() => setCollapsed(!collapsed)}
          className='px-2 py-1 min-w-0'
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
        <div className='flex-1 px-3 py-4 overflow-auto'>
          {Object.entries(fieldGroups).map(([category, categoryFields]) => {
            const isCollapsed = collapsedGroups[category];
            return (
              <div key={category} className='mb-4'>
                {/* Category Header */}
                <button
                  type='button'
                  onClick={() => toggleGroup(category)}
                  className='flex justify-between items-center bg-transparent mb-2 p-2 border-none outline-none w-full cursor-pointer'>
                  <span className='font-semibold text-gray-600 text-xs uppercase tracking-wide'>
                    {category}
                  </span>
                  <span
                    className='text-[10px] text-gray-500 transition-transform duration-200'
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
                  <div className='gap-2 grid grid-cols-2'>
                    {categoryFields.map((f) => (
                      <button
                        key={f.type}
                        type='button'
                        onClick={() => onAddField(f.type)}
                        className='flex flex-col justify-center items-center gap-1.5 bg-white hover:bg-gray-50 px-2 py-3 border border-gray-300 hover:border-blue-600 outline-none min-h-[70px] transition-all duration-150 cursor-pointer'>
                        <span className='flex text-gray-600 text-xl'>
                          {(() => {
                            const IconComponent = getIcon(f.type);
                            return <IconComponent />;
                          })()}
                        </span>
                        <span className='font-medium text-[11px] text-gray-900 text-center break-words leading-tight'>
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
