import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
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
      className={classNames('text-center py-3 mb-4 transition-opacity', {
        'opacity-100': isHovered || showFieldPicker,
        'opacity-30': !isHovered && !showFieldPicker,
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
