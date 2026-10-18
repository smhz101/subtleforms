/**
 * Turn a failed save response into a sentence that names the setting at
 * fault (2.3.1, QA-03): "Payment settings: add an amount" instead of
 * "Failed to autosave".
 */
import { __, sprintf } from '@wordpress/i18n';

const AREAS = [
  [/^schema\.metadata\.payment/, () => __('Payment settings', 'subtleforms')],
  [/^schema\.metadata\.(confirmation|confirmations)/, () => __('Confirmation settings', 'subtleforms')],
  [/^schema\.metadata/, () => __('Form settings', 'subtleforms')],
  [/^schema\.actions/, () => __('Notifications & actions', 'subtleforms')],
  [/^schema\.fields/, () => __('Fields', 'subtleforms')],
  [/^schema\.logic/, () => __('Logic', 'subtleforms')],
];

function areaOf(path) {
  // "Fields: Maximum length is 255 characters" does not say which setting.
  // Name the one that failed (the label, the help text, the placeholder).
  if (/^schema\.fields/.test(path)) {
    const leaf = path.split('.').pop();
    const names = {
      label: () => __('Field label', 'subtleforms'),
      description: () => __('Field help text', 'subtleforms'),
      placeholder: () => __('Placeholder', 'subtleforms'),
      title: () => __('Field title', 'subtleforms'),
    };
    if (names[leaf]) {
      return names[leaf]();
    }
    return __('Fields', 'subtleforms');
  }
  const hit = AREAS.find(([re]) => re.test(path));
  return hit ? hit[1]() : '';
}

/**
 * @param {Object} body   Error response body ({ error: { message, meta: { fields } } }).
 * @param {string} status HTTP status.
 * @return {string} Readable message.
 */
export function describeSaveError(body, status) {
  const error = body?.error || body?.data?.error || body || {};
  const fields = error?.meta?.fields || body?.meta?.fields || error?.fields || null;
  const base = error?.message || body?.message || '';
  if (fields && typeof fields === 'object') {
    const [path, message] = Object.entries(fields)[0] || [];
    if (path) {
      const area = areaOf(path);
      return area
        ? sprintf(
            /* translators: 1: settings area, 2: problem */
            __('%1$s: %2$s', 'subtleforms'),
            area,
            message
          )
        : `${message}`;
    }
  }
  if (base) return base;
  if (status === 0) return __('Could not reach the server. Check your connection and try again.', 'subtleforms');
  return __('Could not save your changes. Please try again.', 'subtleforms');
}
