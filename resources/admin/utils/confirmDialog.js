/**
 * Promise-based confirmation and notice dialogs (UX2-10).
 *
 * Every "Are you sure?" and every error notice in the admin uses the same
 * ConfirmModal, instead of the browser's window.confirm and window.alert.
 * The helpers work from event handlers and hooks alike:
 *
 *   if ( ! ( await confirmDialog( { message, confirmText, destructive: true } ) ) ) return;
 *   await noticeDialog( { message } );
 */

import { createElement, render, unmountComponentAtNode } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import ConfirmModal from '../modals/ConfirmModal';

function open(props) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'subtleforms-dialog-host';
    document.body.appendChild(host);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      unmountComponentAtNode(host);
      host.remove();
      resolve(value);
    };

    render(
      createElement(ConfirmModal, {
        isOpen: true,
        ...props,
        onConfirm: () => finish(true),
        onClose: () => finish(false),
      }),
      host
    );
  });
}

/**
 * Ask before an action. Resolves true when the user confirms.
 *
 * @param {Object}  args
 * @param {string}  args.message     The question.
 * @param {string}  [args.title]     Dialog title.
 * @param {string}  [args.confirmText] Primary button label.
 * @param {string}  [args.cancelText]  Cancel button label.
 * @param {boolean} [args.destructive] Red primary button.
 * @return {Promise<boolean>}
 */
export function confirmDialog({ message, title, confirmText, cancelText, destructive = false }) {
  return open({
    title: title || __('Are you sure?', 'subtleforms'),
    message,
    confirmText: confirmText || __('Continue', 'subtleforms'),
    cancelText: cancelText || __('Cancel', 'subtleforms'),
    confirmVariant: destructive ? 'destructive' : 'primary',
  });
}

/**
 * Tell the user something that needs acknowledging (replaces window.alert).
 *
 * @param {Object} args
 * @param {string} args.message Message.
 * @param {string} [args.title] Title.
 * @return {Promise<void>}
 */
export function noticeDialog({ message, title }) {
  return open({
    title: title || __('Something went wrong', 'subtleforms'),
    message,
    confirmText: __('OK', 'subtleforms'),
    showCancel: false,
  }).then(() => undefined);
}
