import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
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
      className={clsx('sf-mb-4 sf-py-3 sf-text-center sf-transition-opacity', {
        'sf-opacity-100': isHovered || showFieldPicker,
        'sf-opacity-30': !isHovered && !showFieldPicker,
      })}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}>
      <button
        ref={anchorRef}
        onClick={onClick}
        className='sf-inline-flex sf-items-center sf-gap-1 sf-bg-transparent sf-px-4 sf-py-1.5 sf-border sf-border-gray-400 sf-border-dashed sf-font-medium sf-text-gray-600 sf-text-xs sf-cursor-pointer'>
        {(() => {
          const AddIcon = getIcon('add');
          return <AddIcon size={16} />;
        })()}
        {__('Insert Field', 'subtleforms')}
      </button>
    </div>
  );
}
