import { __ } from '@wordpress/i18n';
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
        className='inline-flex items-center gap-1 bg-transparent px-4 py-1.5 border border-gray-400 border-dashed font-medium text-gray-600 text-xs cursor-pointer'>
        {(() => {
          const AddIcon = getIcon('add');
          return <AddIcon size={16} />;
        })()}
        {__('Insert Field', 'subtleforms')}
      </button>
    </div>
  );
}
