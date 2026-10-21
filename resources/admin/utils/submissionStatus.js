/**
 * The label and pill style for an entry status, shared by the entries list,
 * the dashboard and the entry screen so they never disagree (PAY-22).
 */
import { __ } from '@wordpress/i18n';

export function submissionStatus(status) {
  const map = {
    completed: { label: __('Completed', 'subtleforms'), cls: 'sf-pill--success' },
    saved: { label: __('Saved', 'subtleforms'), cls: '' },
    processing: { label: __('Processing', 'subtleforms'), cls: 'sf-pill--info' },
    failed: { label: __('Failed', 'subtleforms'), cls: 'sf-pill--danger' },
    payment_pending: { label: __('Awaiting payment', 'subtleforms'), cls: 'sf-pill--warning' },
    payment_failed: { label: __('Payment failed', 'subtleforms'), cls: 'sf-pill--danger' },
    spam: { label: __('Spam', 'subtleforms'), cls: 'sf-pill--danger' },
    flagged: { label: __('Flagged', 'subtleforms'), cls: 'sf-pill--warning' },
    trash: { label: __('Trashed', 'subtleforms'), cls: 'sf-pill--danger' },
    archived: { label: __('Archived', 'subtleforms'), cls: '' },
    preview: { label: __('Preview', 'subtleforms'), cls: 'sf-pill--info' },
  };
  return map[status] || { label: __('Received', 'subtleforms'), cls: '' };
}
