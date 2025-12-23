import { useState } from '@wordpress/element';
import { Button, Icon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';

export default function FieldDock({ fieldGroups, onAddField }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!fieldGroups || Object.keys(fieldGroups).length === 0) {
    return (
      <div
        className={`
        subtleforms-admin w-80 bg-white border-r border-gray-200 shadow-sm flex flex-col
        ${collapsed ? 'w-12' : ''}
      `}>
        <div className='flex-shrink-0 px-4 py-3 border-gray-200 border-b'>
          <p className='m-0 text-gray-500 text-sm'>
            {__('Loading fields...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
      subtleforms-admin bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-200
      ${collapsed ? 'w-12' : 'w-80'}
    `}>
      {/* Sticky Header */}
      <div className='flex-shrink-0 bg-gray-50 px-4 py-3 border-gray-200 border-b'>
        <div className='flex justify-between items-center'>
          {!collapsed && (
            <h3 className='m-0 font-semibold text-gray-900 text-sm'>
              {__('Add Fields', 'subtleforms')}
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
      </div>

      {/* Scrollable Content */}
      {!collapsed && (
        <div className='flex-1 p-4 subtleforms-scrollable'>
          <div className='space-y-6'>
            {Object.entries(fieldGroups).map(([category, categoryFields]) => (
              <div key={category}>
                <h4 className='mb-3 font-semibold text-gray-500 text-xs uppercase tracking-wide'>
                  {category}
                </h4>
                <div className='gap-2 grid grid-cols-2'>
                  {categoryFields.map((f) => (
                    <button
                      type='button'
                      key={f.type}
                      onClick={() => onAddField(f.type)}
                      className='flex flex-col items-center gap-2 bg-gray-50 hover:bg-gray-100 hover:shadow-sm p-3 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-900 text-xs text-center transition-all duration-150 cursor-pointer'>
                      <span className='flex text-gray-600 text-lg'>
                        <Icon icon={getIcon(f.type)} size={20} />
                      </span>
                      <span className='font-medium break-words leading-tight'>
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
