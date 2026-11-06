import { apiClient } from '../../../data/apiClient';

const BASE = '/integrations/email-marketing';

/**
 * Email marketing calls for Settings and the form builder. The server never
 * sends an API key back: state() carries only its last four characters.
 */
export const emailMarketingApi = {
  all: () => apiClient.get(BASE),
  state: (service) => apiClient.get(`${BASE}/${service}`),
  setEnabled: (service, enabled) => apiClient.post(`${BASE}/${service}/enabled`, { enabled }),
  connect: (service, apiKey) => apiClient.post(`${BASE}/${service}/connect`, { api_key: apiKey }),
  test: (service) => apiClient.post(`${BASE}/${service}/test`, {}),
  disconnect: (service) => apiClient.delete(`${BASE}/${service}`),
  saveSettings: (service, values) => apiClient.post(`${BASE}/${service}/settings`, values),
  lists: (service, refresh = false) => apiClient.get(`${BASE}/${service}/lists${refresh ? '?refresh=1' : ''}`),
  fields: (service, listId = '', refresh = false) => {
    const query = [];
    if (listId) query.push(`list_id=${encodeURIComponent(listId)}`);
    if (refresh) query.push('refresh=1');
    return apiClient.get(`${BASE}/${service}/fields${query.length ? `?${query.join('&')}` : ''}`);
  },
  brevoTemplates: (refresh = false) => apiClient.get(`${BASE}/brevo/templates${refresh ? '?refresh=1' : ''}`),
  dismissBanner: () => apiClient.post(`${BASE}/banner/dismiss`, {}),
};

/** What the server handed this page about email marketing (`subtleformsAdmin.emailMarketing`). */
export function pageData() {
  if (typeof window === 'undefined') return { services: {}, extras: [], banner: { show: false, url: '' } };
  const data = window.subtleformsAdmin?.emailMarketing || {};
  return {
    services: data.services || {},
    extras: Array.isArray(data.extras) ? data.extras : [],
    banner: data.banner || { show: false, url: '' },
  };
}

/**
 * Whether this plugin's own Email marketing is the one the Settings list
 * shows. An add-on that lists its own `email_marketing` entry (without
 * `builtin`) takes over, and every Email marketing screen of this plugin
 * leaves the screen to it.
 *
 * @return {boolean} True when the built-in screens should be drawn.
 */
export function isBuiltInEmailMarketing() {
  return window.subtleformsAdmin?.extensions?.email_marketing?.builtin === true;
}

/**
 * Keep the page data and the Settings sidebar dot in step with a change made
 * in a panel.
 *
 * @param {string} service Service slug.
 * @param {Object} change  { enabled, status }: the new switch and/or connection status.
 */
export function announceService(service, change = {}) {
  const data = window.subtleformsAdmin?.emailMarketing;
  const entry = data?.services?.[service];
  if (entry) {
    if (typeof change.enabled === 'boolean') entry.enabled = change.enabled;
    if (typeof change.status === 'string') entry.configured = change.status === 'connected';
  }
  const ext = window.subtleformsAdmin?.extensions?.email_marketing;
  if (ext && data?.services) {
    const list = Object.values(data.services).filter((s) => s && s.builtin !== false);
    ext.enabled = list.some((s) => s.enabled);
    ext.configured = list.some((s) => s.enabled && s.configured);
  }
  window.dispatchEvent(new CustomEvent('subtleforms:extension-status'));
}

/**
 * Whether a service can send: a key was accepted (or, for a service that
 * lives on the same site such as MailPoet, it is installed and set up).
 * The server says so in `connected`; the older fields are the fallback.
 *
 * @param {Object} state Connection state from the server.
 * @return {boolean} True when the service is usable.
 */
export function isConnected(state) {
  if (!state) return false;
  if (typeof state.connected === 'boolean') return state.connected;
  return state.has_key === true && state.status !== 'error';
}
