/**
 * Email merge tags (2.3.0). The server (src/Support/MergeTags.php) accepts
 * every tag with single or double braces; the builder inserts single braces.
 */
import { __ } from '@wordpress/i18n';

export const GLOBAL_MERGE_TAGS = [
  { tag: '{all_fields}', label: __('All fields', 'subtleforms'), help: __('Every answer with its label. Passwords are never included.', 'subtleforms') },
  { tag: '{form_title}', label: __('Form title', 'subtleforms'), help: __('The title of this form.', 'subtleforms') },
  { tag: '{entry_id}', label: __('Entry number', 'subtleforms'), help: __('The number of the entry in Submissions.', 'subtleforms') },
  { tag: '{site_name}', label: __('Site name', 'subtleforms'), help: __('Your site title from Settings, General.', 'subtleforms') },
  { tag: '{admin_email}', label: __('Admin email', 'subtleforms'), help: __('The site admin email address.', 'subtleforms') },
  { tag: '{date}', label: __('Date', 'subtleforms'), help: __('The date and time the entry was sent, in your site format.', 'subtleforms') },
];

/** Field types that hold no answer, or must never be emailed. */
const SKIP = ['password', 'html', 'section_break', 'disclaimer', 'step', 'action_hook', 'payment_summary', 'payment_card'];

/**
 * One {field:key} tag per answer-bearing field.
 *
 * @param {Array<{key: string, label: string, type: string}>} fields Form fields.
 * @return {Array<{tag: string, label: string}>}
 */
export function fieldMergeTags(fields = []) {
  return (fields || [])
    .filter((f) => f && f.key && !SKIP.includes(f.type))
    .map((f) => ({ tag: `{field:${f.key}}`, label: f.label || f.key }));
}

/**
 * Insert text into a value at a caret position.
 *
 * @param {string} value Current value.
 * @param {string} text  Text to insert.
 * @param {number|null} start Selection start (null: append).
 * @param {number|null} end   Selection end.
 * @return {{value: string, caret: number}}
 */
export function insertAt(value, text, start = null, end = null) {
  const current = value || '';
  if (start === null || start === undefined || start < 0 || start > current.length) {
    const sep = current && !/\s$/.test(current) ? ' ' : '';
    const next = current + sep + text;
    return { value: next, caret: next.length };
  }
  const to = end === null || end === undefined ? start : end;
  const next = current.slice(0, start) + text + current.slice(to);
  return { value: next, caret: start + text.length };
}
