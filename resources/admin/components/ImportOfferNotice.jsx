import { Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';
import { useImportOffer, useImportOfferAction } from '../data';
import { goToToolsMigrate } from './ImportOfferModal';

/**
 * Join plugin labels: A; A and B; A, B and C.
 *
 * @param {string[]} labels Labels.
 * @return {string}
 */
export function joinLabels(labels) {
  const list = (labels || []).map((l) => String(l || '').trim()).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) {
    return sprintf(
      /* translators: 1: first plugin name, 2: second plugin name */
      __('%1$s and %2$s', 'subtleforms'),
      list[0],
      list[1]
    );
  }
  return sprintf(
    /* translators: 1: comma-separated plugin names, 2: last plugin name */
    __('%1$s and %2$s', 'subtleforms'),
    list.slice(0, -1).join(', '),
    list[list.length - 1]
  );
}

/**
 * Dismissible notice after the import offer modal is closed without importing.
 */
export default function ImportOfferNotice() {
  const { data } = useImportOffer();
  const dismiss = useImportOfferAction('dismiss');
  const navigate = useNavigate();

  if (data?.offer !== 'notice') {
    return null;
  }

  const names = joinLabels(data?.labels || []);
  const busy = dismiss.isPending;

  const runDismiss = () => {
    if (busy) return;
    dismiss.mutate(undefined);
  };

  const runImport = () => {
    if (busy) return;
    dismiss.mutate(undefined, {
      onSettled: () => goToToolsMigrate(navigate),
    });
  };

  return (
    <div className='sf-import-offer-notice'>
      <Notice
        status='info'
        isDismissible
        onRemove={runDismiss}
        actions={[
          {
            label: __('Import forms', 'subtleforms'),
            onClick: runImport,
            variant: 'primary',
          },
          {
            label: __('Dismiss', 'subtleforms'),
            onClick: runDismiss,
            variant: 'tertiary',
          },
        ]}>
        <p>
          {names
            ? sprintf(
                /* translators: %s: comma-separated plugin names */
                __('You can import forms from %s.', 'subtleforms'),
                names
              )
            : __('You can import forms from other form plugins on this site.', 'subtleforms')}
        </p>
      </Notice>
    </div>
  );
}
