import { __ } from '@wordpress/i18n';
import { Icon, Button } from '@wordpress/components';
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
      className={`relative mb-4 bg-white transition-all ${
        isSelected ? 'border-2 border-blue-600' : 'border border-gray-300'
      }`}>
      {/* Header */}
      <div className='px-3 py-2 bg-gray-100 border-b border-gray-300 flex items-center justify-between cursor-move'>
        <div className='flex items-center gap-2'>
          <Icon icon={getIcon(field.type)} size={20} />
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
            <Button
              isSmall
              icon='arrow-up-alt2'
              onClick={() => onMoveUp(path)}
              label={__('Move Up', 'subtleforms')}
            />
            <Button
              isSmall
              icon='arrow-down-alt2'
              onClick={() => onMoveDown(path)}
              label={__('Move Down', 'subtleforms')}
            />
            <Button
              isSmall
              icon='admin-page'
              onClick={() => onDuplicate(path)}
              label={__('Duplicate', 'subtleforms')}
            />
            <Button
              isSmall
              icon='trash'
              isDestructive
              onClick={() => onDelete(path)}
              label={__('Delete', 'subtleforms')}
            />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className='p-4 min-h-[60px]'>{children}</div>

      {isRepeat && (
        <div className='px-4 py-2 border-t border-dashed border-gray-300 text-gray-600 text-xs italic'>
          {__('Repeatable items will appear here', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
