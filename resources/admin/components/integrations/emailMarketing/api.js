import { apiClient } from '../../../data/apiClient';

const BASE = '/integrations/mailchimp';

/**
 * Mailchimp calls for Settings and the form builder. The server never sends
 * the API key back: state() carries only its last four characters.
 */
export const mailchimpApi = {
  state: () => apiClient.get(BASE),
  connect: (apiKey) => apiClient.post(`${BASE}/connect`, { api_key: apiKey }),
  test: () => apiClient.post(`${BASE}/test`, {}),
  disconnect: () => apiClient.delete(BASE),
  audiences: (refresh = false) => apiClient.get(`${BASE}/audiences${refresh ? '?refresh=1' : ''}`),
  fields: (listId, refresh = false) =>
    apiClient.get(`${BASE}/audiences/${encodeURIComponent(listId)}/fields${refresh ? '?refresh=1' : ''}`),
};

/**
 * Whether this plugin's own Mailchimp is the one the Settings list shows.
 * An add-on that lists its own `mailchimp` entry (without `builtin`) takes
 * over, and both built-in Mailchimp panels leave the screen to it.
 *
 * @return {boolean} True when the built-in panels should be drawn.
 */
export function isBuiltInMailchimp() {
  return window.subtleformsAdmin?.extensions?.mailchimp?.builtin === true;
}

/**
 * Keep the Settings sidebar dot in step with a change made in the panel.
 *
 * @param {string} status connected, error or none.
 */
export function announceStatus(status) {
  const ext = window.subtleformsAdmin?.extensions?.mailchimp;
  if (ext) {
    ext.enabled = status !== 'none';
    ext.configured = status === 'connected';
  }
  window.dispatchEvent(new CustomEvent('subtleforms:extension-status'));
}
