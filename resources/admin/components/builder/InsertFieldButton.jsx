import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
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
    <div className='insert-field-button__wrapper'>
      <button
        type='button'
        ref={buttonRef}
        className='insert-field-button__button'
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
        }}>
        <span aria-hidden='true'>＋</span>
        <span>{label || __('Insert Field', 'subtleforms')}</span>
      </button>
    </div>
  );
}
