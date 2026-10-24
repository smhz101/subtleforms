import { Modal, Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';
import { useImportOffer, useImportOfferAction } from '../data';

/**
 * Open Settings on the Tools tab, Migrate section (Site Import).
 *
 * @param {Function} navigate React Router navigate.
 */
export function goToToolsMigrate(navigate) {
  try {
    window.history.replaceState(null, '', '#tab=tools&section=migrate');
  } catch (e) {
    // Hash is only a convenience.
  }
  navigate('/settings');
}

/**
 * Fresh-install modal listing form plugins with forms on this site.
 */
export default function ImportOfferModal() {
  const { data } = useImportOffer();
  const defer = useImportOfferAction('defer');
  const dismiss = useImportOfferAction('dismiss');
  const navigate = useNavigate();

  if (data?.offer !== 'modal') {
    return null;
  }

  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const busy = defer.isPending || dismiss.isPending;

  const close = () => {
    if (busy) return;
    defer.mutate(undefined);
  };

  const runImport = () => {
    if (busy) return;
    dismiss.mutate(undefined, {
      onSettled: () => goToToolsMigrate(navigate),
    });
  };

  return (
    <Modal
      title={__('Import your existing forms?', 'subtleforms')}
      onRequestClose={close}
      className='sf-import-offer-modal'>
      <p>
        {__(
          'SubtleForms found forms from other plugins on this site. Import creates SubtleForms drafts. The originals are only read.',
          'subtleforms'
        )}
      </p>
      <ul className='sf-import-offer-modal__list'>
        {sources.map((source) => (
          <li key={source.id}>
            <strong>{source.label}</strong>
            {': '}
            {sprintf(
              /* translators: %s: number of forms */
              _n('%s form', '%s forms', Number(source.count) || 0, 'subtleforms'),
              Number(source.count || 0).toLocaleString()
            )}
          </li>
        ))}
      </ul>
      <p className='sf-import-offer-modal__note'>
        {__(
          'Import is available for Contact Form 7, Gravity Forms and Fluent Forms. Other plugins are listed when their forms are found.',
          'subtleforms'
        )}
      </p>
      <div className='sf-import-offer-modal__actions'>
        <Button variant='primary' disabled={busy} onClick={runImport}>
          {__('Import forms', 'subtleforms')}
        </Button>
        <Button variant='tertiary' disabled={busy} onClick={close}>
          {__('Not now', 'subtleforms')}
        </Button>
      </div>
    </Modal>
  );
}
