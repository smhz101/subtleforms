/**
 * Requests from the live form to the SubtleForms REST API.
 *
 * Visitors who are not logged in need no nonce, and a nonce baked into a
 * cached page expires after a day or two. So the nonce is only sent when the
 * page was made for a logged-in user, and a request refused for an expired
 * nonce is sent once more without it (FF-03).
 */

export const restUrl = (
  (typeof window !== 'undefined' &&
    (window.subtleformsFrontend?.restUrl || window.subtleformsAdmin?.restUrl)) ||
  '/wp-json/subtleforms/v1'
).replace(/\/$/, '');

/** The REST nonce for this page, or '' for visitors. */
export function restNonce() {
  if (typeof window === 'undefined') return '';
  return window.subtleformsFrontend?.nonce || window.subtleformsAdmin?.restNonce || '';
}

/**
 * Fetch a SubtleForms REST route.
 *
 * @param {string} path    Route under subtleforms/v1, for example '/submit'.
 * @param {Object} options { method, body (sent as JSON), headers }.
 * @return {Promise<Response>} Response.
 */
export async function restFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const url = `${restUrl}/${String(path).replace(/^\//, '')}`;
  const nonce = restNonce();
  const send = (withNonce) =>
    fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(withNonce && nonce ? { 'X-WP-Nonce': nonce } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const response = await send(true);
  if (nonce && response.status === 403) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === 'rest_cookie_invalid_nonce') {
      return send(false);
    }
  }
  return response;
}
