import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { FiArrowUp, FiArrowDown, FiCopy, FiTrash2 } from 'react-icons/fi';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';

export default function ContainerWrapper({
  field,
  path,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  children,
}) {
  const isRepeat = field.type === 'repeat_container';
  const columns = field.columns || 1;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(path);
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onHover(path);
      }}
      onMouseLeave={() => onHover(null)}
      className={clsx(
        'sf-relative sf-bg-white sf-mb-4 sf-transition-all',
        isSelected
          ? 'sf-border-2 sf-border-blue-600'
          : 'sf-border sf-border-gray-300'
      )}>
      {/* Header */}
      <div className='sf-flex sf-justify-between sf-items-center sf-bg-gray-100 sf-px-3 sf-py-2 sf-border-gray-300 sf-border-b sf-cursor-move'>
        <div className='sf-flex sf-items-center sf-gap-2'>
          {(() => {
            const ContainerIcon = getIcon(field.type);
            return <ContainerIcon size={20} />;
          })()}
          <span className='sf-font-semibold sf-text-xs'>
            {field.label ||
              (isRepeat
                ? __('Repeat Container', 'subtleforms')
                : __(`${columns} Columns`, 'subtleforms'))}
          </span>
        </div>

        {/* Actions */}
        {isSelected && (
          <div className='sf-flex sf-gap-1'>
            <button
              onClick={() => onMoveUp(path)}
              className='hover:sf-bg-gray-200 sf-p-1 sf-rounded'
              title={__('Move Up', 'subtleforms')}>
              <FiArrowUp className='sf-w-4 sf-h-4' />
            </button>
            <button
              onClick={() => onMoveDown(path)}
              className='hover:sf-bg-gray-200 sf-p-1 sf-rounded'
              title={__('Move Down', 'subtleforms')}>
              <FiArrowDown className='sf-w-4 sf-h-4' />
            </button>
            <button
              onClick={() => onDuplicate(path)}
              className='hover:sf-bg-gray-200 sf-p-1 sf-rounded'
              title={__('Duplicate', 'subtleforms')}>
              <FiCopy className='sf-w-4 sf-h-4' />
            </button>
            <button
              onClick={() => onDelete(path)}
              className='hover:sf-bg-red-100 sf-p-1 sf-rounded sf-text-red-600'
              title={__('Delete', 'subtleforms')}>
              <FiTrash2 className='sf-w-4 sf-h-4' />
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className='sf-p-4 sf-min-h-[60px]'>{children}</div>

      {isRepeat && (
        <div className='sf-px-4 sf-py-2 sf-border-gray-300 sf-border-t sf-border-dashed sf-text-gray-600 sf-text-xs sf-italic'>
          {__('Repeatable items will appear here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
