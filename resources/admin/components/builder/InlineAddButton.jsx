import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';
import './InlineAddButton.scss';

export default function InlineAddButton({
  index,
  isHovered,
  showFieldPicker,
  onHover,
  onLeave,
  onClick,
  anchorRef,
}) {
  const isActive = isHovered || showFieldPicker;
  
  return (
    <div
      className={clsx('inline-add-button', {
        'inline-add-button--active': isActive,
        'inline-add-button--idle': !isActive,
      })}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}>
      <button
        ref={anchorRef}
        onClick={onClick}
        className='inline-add-button__button'>
        {(() => {
          const AddIcon = getIcon('add');
          return <AddIcon size={16} />;
        })()}
        {__('Insert Field', 'subtleforms')}
      </button>
    </div>
  );
}
