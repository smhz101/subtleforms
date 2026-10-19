import { __ } from '@wordpress/i18n';
import { serverFieldErrors } from './serverErrors';

/**
 * Answers that are never restored into the form.
 */
const SKIP = [
  'website_url',
  'form_rendered_at',
  'g-recaptcha-response',
  'h-captcha-response',
  'cf-turnstile-response',
  '_payment',
];

/**
 * The outcome of a form posted without AJAX, as the block hands it over in
 * `data-classic-result` (2.4.0).
 *
 * @param {string|Object|null} raw JSON from the data attribute, or the parsed object.
 * @return {null|{ok: true, confirmation: Object|null, submissionId: (number|string), values: Object}|{ok: false, fieldErrors: Object<string, string>, message: string, values: Object}}
 */
export function classicOutcome(raw) {
  let result = raw;
  if (typeof raw === 'string') {
    if (!raw) {
      return null;
    }
    try {
      result = JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (!result || typeof result !== 'object') {
    return null;
  }
  const body = result.body && typeof result.body === 'object' ? result.body : {};
  const values = {};
  if (result.values && typeof result.values === 'object' && !Array.isArray(result.values)) {
    Object.keys(result.values).forEach((key) => {
      if (!SKIP.includes(key)) {
        values[key] = result.values[key];
      }
    });
  }
  if (result.ok) {
    return {
      ok: true,
      confirmation: body?.data?.confirmation || null,
      submissionId: body?.data?.submission_id || '',
      values,
    };
  }
  return {
    ok: false,
    fieldErrors: serverFieldErrors(body),
    message:
      body?.error?.message || body?.data?.message || __('Submission failed.', 'subtleforms'),
    values,
  };
}

/**
 * Drop the outcome token from the address bar, so a reload shows a fresh form.
 *
 * @param {string} param Query argument.
 */
export function forgetClassicToken(param = 'subtleforms_result') {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch (e) {
    // Older browsers keep the token; it is single use on the server.
  }
}
