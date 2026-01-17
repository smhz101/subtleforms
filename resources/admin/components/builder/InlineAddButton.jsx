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
        <svg
          width='20'
          height='20'
          viewBox='0 0 20 20'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'>
          <circle
            cx='10'
            cy='10'
            r='9'
            stroke='currentColor'
            strokeWidth='1.5'
          />
          <path
            d='M10 6v8m-4-4h8'
            stroke='currentColor'
            strokeWidth='1.5'
            strokeLinecap='round'
          />
        </svg>
        {label && <span className='sf-inline-add-button__label'>{label}</span>}
      </button>
    </div>
  );
}
