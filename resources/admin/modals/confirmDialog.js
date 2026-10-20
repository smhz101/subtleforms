/**
 * Promise-based ConfirmModal for places that still call window.confirm.
 *
 * A single host (ConfirmDialogHost) listens and renders ConfirmModal. Callers
 * await askConfirm(...) and get true/false without a native dialog.
 */

let listener = null;

/**
 * Register the host that renders the modal. Returns an unsubscribe function.
 *
 * @param {Function} next Listener that receives the pending request or null.
 * @return {Function} Unsubscribe.
 */
export function subscribeConfirm(next) {
  listener = next;
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

/**
 * Ask the user to confirm. Resolves true on confirm, false on cancel/close.
 *
 * @param {Object} options Modal props without isOpen/onClose/onConfirm.
 * @return {Promise<boolean>}
 */
export function askConfirm(options = {}) {
  if (typeof listener !== 'function') {
    // Fallback when the host is not mounted (unit tests, rare early calls).
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(String(options.message || '')));
    }
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    listener({
      title: options.title || '',
      message: options.message || '',
      confirmText: options.confirmText,
      confirmVariant: options.confirmVariant || 'primary',
      cancelText: options.cancelText,
      resolve,
    });
  });
}

/**
 * Show a blocking message where alert() was used. Resolves when dismissed.
 *
 * @param {Object} options Modal props.
 * @return {Promise<void>}
 */
export function askAlert(options = {}) {
  return askConfirm({
    title: options.title || '',
    message: options.message || '',
    confirmText: options.confirmText,
    confirmVariant: 'primary',
    cancelText: options.cancelText || ' ',
  }).then(() => undefined);
}
