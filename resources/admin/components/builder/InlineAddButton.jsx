import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { getIcon } from './utils/iconMap';
import Icon from '../ui/Icon';
import './InlineAddButton.scss';

export default function InlineAddButton({
  index,
  isHovered,
  showFieldPicker,
  onHover,
  onLeave,
  onClick,
  anchorRef,
  label,
}) {
  const isActive = isHovered || showFieldPicker;

  return (
    <div
      className={clsx('sf-inline-add-button', {
        'sf-inline-add-button--active': isActive,
        'sf-inline-add-button--idle': !isActive,
      })}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}>
      <button
        ref={anchorRef}
        onClick={onClick}
        className='sf-inline-add-button__button'
        title={__('Add Field', 'subtleforms')}>
        <Icon.Plus size={20} />
        {label && <span className='sf-inline-add-button__label'>{label}</span>}
      </button>
    </div>
  );
}
