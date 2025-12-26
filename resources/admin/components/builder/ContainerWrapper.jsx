import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { FiArrowUp, FiArrowDown, FiCopy, FiTrash2 } from 'react-icons/fi';
import classNames from 'classnames';
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
      className={classNames(
        'relative mb-4 bg-white transition-all',
        isSelected ? 'border-2 border-blue-600' : 'border border-gray-300'
      )}>
      {/* Header */}
      <div className='flex justify-between items-center bg-gray-100 px-3 py-2 border-gray-300 border-b cursor-move'>
        <div className='flex items-center gap-2'>
          {(() => {
            const ContainerIcon = getIcon(field.type);
            return <ContainerIcon size={20} />;
          })()}
          <span className='font-semibold text-xs'>
            {field.label ||
              (isRepeat
                ? __('Repeat Container', 'subtleforms')
                : __(`${columns} Columns`, 'subtleforms'))}
          </span>
        </div>

        {/* Actions */}
        {isSelected && (
          <div className='flex gap-1'>
            <button
              onClick={() => onMoveUp(path)}
              className='hover:bg-gray-200 p-1 rounded'
              title={__('Move Up', 'subtleforms')}>
              <FiArrowUp className='w-4 h-4' />
            </button>
            <button
              onClick={() => onMoveDown(path)}
              className='hover:bg-gray-200 p-1 rounded'
              title={__('Move Down', 'subtleforms')}>
              <FiArrowDown className='w-4 h-4' />
            </button>
            <button
              onClick={() => onDuplicate(path)}
              className='hover:bg-gray-200 p-1 rounded'
              title={__('Duplicate', 'subtleforms')}>
              <FiCopy className='w-4 h-4' />
            </button>
            <button
              onClick={() => onDelete(path)}
              className='hover:bg-red-100 p-1 rounded text-red-600'
              title={__('Delete', 'subtleforms')}>
              <FiTrash2 className='w-4 h-4' />
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className='p-4 min-h-[60px]'>{children}</div>

      {isRepeat && (
        <div className='px-4 py-2 border-gray-300 border-t border-dashed text-gray-600 text-xs italic'>
          {__('Repeatable items will appear here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
