import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { getIcon } from './utils/iconMap';

export default function InlineAddButton({
  index,
  isHovered,
  showFieldPicker,
  onHover,
  onLeave,
  onClick,
  anchorRef,
}) {
  return (
    <div
      className={`text-center py-3 mb-4 transition-opacity ${
        isHovered || showFieldPicker ? 'opacity-100' : 'opacity-30'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}>
      <button
        ref={anchorRef}
        onClick={onClick}
        className='px-4 py-1.5 text-xs border border-dashed border-gray-400 bg-transparent cursor-pointer text-gray-600 font-medium inline-flex items-center gap-1'>
        <Icon icon={getIcon('add')} size={16} />
        {__('Insert Field', 'subtleforms')}
      </button>
    </div>
  );
}
