import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default function InsertFieldButton({
  parentId,
  columnIndex,
  position,
  onRequestInsert,
  label,
}) {
  const buttonRef = useRef(null);

  return (
    <div className='subtleforms-insert-button-wrapper'>
      <button
        type='button'
        ref={buttonRef}
        className='subtleforms-insert-button'
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
        <span>{label || __('Insert field', 'subtleforms')}</span>
      </button>
    </div>
  );
}
