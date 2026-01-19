import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import './InsertFieldButton.scss';

export default function InsertFieldButton({
  parentId,
  columnIndex,
  position,
  onRequestInsert,
  label,
}) {
  const buttonRef = useRef(null);

  return (
    <div className='sf-insert-field-button__wrapper'>
      <button
        type='button'
        ref={buttonRef}
        className='sf-insert-field-button__button'
        onClick={(event) => {
          event.stopPropagation();
          onRequestInsert(
            {
              parentId,
              columnIndex,
              position,
            },
            buttonRef.current
          );
        }}
        aria-label={label || __('Insert Field', 'subtleforms')}>
        <span className='sf-insert-field-button__icon'>
          <Icon.Plus />
        </span>
        <span className='sf-insert-field-button__text'>
          {label || __('Insert Field', 'subtleforms')}
        </span>
      </button>
    </div>
  );
}
