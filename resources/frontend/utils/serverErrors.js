import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Field errors from a failed submit response, keyed by field path.
 *
 * The REST API answers a rejected submission with 422 and
 * `{ error: { code, message, meta: { fields: { key: message } } } }`.
 * Older responses used `data.errors` or `error.meta.errors`. A message may be
 * a string or a list of strings; the first one is shown.
 *
 * @param {Object} result Parsed JSON body.
 * @return {Object<string, string>} Field path => message.
 */
export function serverFieldErrors(result) {
  const raw =
    result?.error?.meta?.fields ||
    result?.error?.meta?.errors ||
    result?.data?.errors ||
    result?.errors ||
    null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out = {};
  Object.keys(raw).forEach((key) => {
    let message = raw[key];
    if (Array.isArray(message)) {
      message = message.find((m) => typeof m === 'string' && m.trim());
    } else if (message && typeof message === 'object') {
      message = message.message;
    }
    if (typeof message === 'string' && message.trim() && key) {
      out[key] = message.trim();
    }
  });
  return out;
}

/**
 * The summary shown above a form whose fields need fixing.
 *
 * @param {number} count Number of fields with an error.
 * @return {string}
 */
export function fixFieldsSummary(count) {
  if (count === 1) {
    return __('Please fix the highlighted field.', 'subtleforms');
  }
  return sprintf(
    /* translators: %d: number of fields with an error */
    _n(
      'Please fix the %d highlighted field.',
      'Please fix the %d highlighted fields.',
      count,
      'subtleforms'
    ),
    count
  );
}
