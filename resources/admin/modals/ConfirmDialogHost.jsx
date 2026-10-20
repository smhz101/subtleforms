import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import ConfirmModal from './ConfirmModal';
import { subscribeConfirm } from './confirmDialog';

/**
 * Renders the shared ConfirmModal for askConfirm() / askAlert().
 */
export default function ConfirmDialogHost() {
  const [request, setRequest] = useState(null);

  useEffect(() => subscribeConfirm(setRequest), []);

  if (!request) {
    return null;
  }

  const finish = (ok) => {
    const { resolve } = request;
    setRequest(null);
    resolve(ok);
  };

  const hideCancel = !request.cancelText || !String(request.cancelText).trim();

  return (
    <ConfirmModal
      isOpen
      onClose={() => finish(false)}
      title={request.title || __('Please confirm', 'subtleforms')}
      message={request.message}
      onConfirm={() => finish(true)}
      confirmText={request.confirmText || __('OK', 'subtleforms')}
      confirmVariant={request.confirmVariant || 'primary'}
      cancelText={hideCancel ? __('Close', 'subtleforms') : request.cancelText}
    />
  );
}
