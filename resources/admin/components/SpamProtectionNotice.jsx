import { useState } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useSpamProtection, useSpamProtectionAction } from '../data';
import ConfirmModal from '../modals/ConfirmModal';

/**
 * One-time offer for sites that used SubtleForms before 2.6.0: turn the
 * hidden trap field and the too-fast check on for every form. Shown only
 * when some forms have either one off. After turning it on, the notice
 * offers Undo until it is dismissed.
 */
export default function SpamProtectionNotice() {
  const { data } = useSpamProtection();
  const enableAll = useSpamProtectionAction('enable-all');
  const undo = useSpamProtectionAction('undo');
  const dismiss = useSpamProtectionAction('dismiss');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const notice = data?.notice;
  if (notice !== 'invite' && notice !== 'enabled') {
    return null;
  }

  const busy = enableAll.isPending || undo.isPending || dismiss.isPending;
  const run = (mutation, after) => {
    // One request at a time: a second click while one runs does nothing.
    if (busy) return;
    setError('');
    mutation.mutate(undefined, {
      onSuccess: after,
      onError: (err) => setError(err?.message || __('That did not work. Please try again.', 'subtleforms')),
    });
  };

  if (notice === 'enabled') {
    const changed = Number(data?.changed || 0);
    return (
      <div className='sf-spam-notice'>
        <Notice
          status='success'
          isDismissible
          onRemove={() => run(dismiss)}
          actions={[
            {
              label: __('Undo', 'subtleforms'),
              onClick: () => run(undo),
              variant: 'secondary',
            },
          ]}>
          <p>
            {sprintf(
              /* translators: %s: number of forms */
              _n(
                'Spam protection is now on for %s form, and for every form you create.',
                'Spam protection is now on for %s forms, and for every form you create.',
                changed,
                'subtleforms'
              ),
              changed.toLocaleString()
            )}
          </p>
          {error && <p role='alert'>{error}</p>}
        </Notice>
      </div>
    );
  }

  const off = Number(data?.forms_off || 0);
  return (
    <div className='sf-spam-notice'>
      <Notice
        status='info'
        isDismissible
        onRemove={() => run(dismiss)}
        actions={[
          {
            label: __('Turn on for all forms', 'subtleforms'),
            onClick: () => setConfirming(true),
            variant: 'primary',
          },
          {
            label: __('No thanks', 'subtleforms'),
            onClick: () => run(dismiss),
            variant: 'tertiary',
          },
        ]}>
        <p>
          <strong>{__('Stop spam without a puzzle for your visitors', 'subtleforms')}</strong>
        </p>
        <p>
          {sprintf(
            /* translators: %s: number of forms */
            _n(
              '%s form does not use the hidden trap field or the too-fast check. Both stop robots quietly, and visitors never see them.',
              '%s forms do not use the hidden trap field or the too-fast check. Both stop robots quietly, and visitors never see them.',
              off,
              'subtleforms'
            ),
            off.toLocaleString()
          )}
        </p>
        {error && <p role='alert'>{error}</p>}
      </Notice>
      <ConfirmModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={__('Turn on spam protection for all forms?', 'subtleforms')}
        message={__(
          'This turns on the hidden trap field and the too-fast check on every form, and for forms you create later. Nothing else on your forms changes. You can undo it from the next message.',
          'subtleforms'
        )}
        confirmText={__('Turn on for all forms', 'subtleforms')}
        isLoading={enableAll.isPending}
        onConfirm={() => run(enableAll, () => setConfirming(false))}
      />
    </div>
  );
}
