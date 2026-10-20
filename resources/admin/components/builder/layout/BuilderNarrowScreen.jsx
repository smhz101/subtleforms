import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import './BuilderNarrowScreen.scss';

const QUERY = '(max-width: 900px)';

/**
 * Fold the WP admin menu in the builder, and show a notice under 900px
 * when the chrome cannot fit (UX2-17).
 */
export default function BuilderNarrowScreen() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    document.body.classList.add('folded', 'auto-fold', 'subtleforms-builder-folded');
    const mq = window.matchMedia(QUERY);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    mq.addListener?.(onChange);
    return () => {
      document.body.classList.remove('folded', 'auto-fold', 'subtleforms-builder-folded');
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);

  if (!narrow) {
    return null;
  }

  return (
    <div className='sf-builder-narrow' role='status'>
      <p className='sf-builder-narrow__title'>
        {__('The builder needs a wider screen', 'subtleforms')}
      </p>
      <p className='sf-builder-narrow__text'>
        {__(
          'Open this page on a tablet or desktop (about 900px wide or more) to edit the form. You can still use Preview and Entries on this device.',
          'subtleforms'
        )}
      </p>
    </div>
  );
}
