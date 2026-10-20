/**
 * UX2-17: the builder needs room for the field list, the canvas and the
 * inspector. On a phone it says so instead of showing a clipped toolbar.
 */
import { useState, useCallback } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import './SmallScreenNotice.scss';

const KEY = 'subtleforms_builder_small_screen_ok';

function readChoice() {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch (e) {
    return false;
  }
}

/**
 * Whether the user chose to open the builder on a small screen anyway
 * (remembered for this browser tab).
 *
 * @return {[boolean, Function]} Choice and a setter that opens the builder.
 */
export function useSmallScreenChoice() {
  const [openAnyway, setOpenAnyway] = useState(readChoice);
  const choose = useCallback(() => {
    try {
      window.sessionStorage.setItem(KEY, '1');
    } catch (e) {
      // Private windows may refuse storage; the choice lasts until reload.
    }
    setOpenAnyway(true);
  }, []);
  return [openAnyway, choose];
}

export default function SmallScreenNotice({ onBack, onOpenAnyway }) {
  return (
    <div className='sf-builder-small-screen' role='region' aria-label={__('Form builder', 'subtleforms')}>
      <h2 className='sf-builder-small-screen__title'>
        {__('The form builder needs a wider screen', 'subtleforms')}
      </h2>
      <p className='sf-builder-small-screen__text'>
        {__(
          'Edit this form on a tablet or a computer, where the fields, the form and the field settings fit side by side. Entries, forms and settings work on this screen.',
          'subtleforms'
        )}
      </p>
      <div className='sf-builder-small-screen__actions'>
        <Button variant='primary' onClick={onBack}>
          {__('Back to forms', 'subtleforms')}
        </Button>
        <Button variant='tertiary' onClick={onOpenAnyway}>
          {__('Open the builder anyway', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}
