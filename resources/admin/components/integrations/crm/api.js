import { apiClient } from '../../../data/apiClient';

const BASE = '/integrations/crm';

/**
 * CRM calls for Settings and the form builder. The server never sends an
 * access token back: state() carries only its last four characters.
 */
export const crmApi = {
  all: () => apiClient.get(BASE),
  state: (service) => apiClient.get(`${BASE}/${service}`),
  setEnabled: (service, enabled) => apiClient.post(`${BASE}/${service}/enabled`, { enabled }),
  connect: (service, token) => apiClient.post(`${BASE}/${service}/connect`, { token }),
  test: (service) => apiClient.post(`${BASE}/${service}/test`, {}),
  disconnect: (service) => apiClient.delete(`${BASE}/${service}`),
  properties: (service, refresh = false) => apiClient.get(`${BASE}/${service}/properties${refresh ? '?refresh=1' : ''}`),
  dismissBanner: () => apiClient.post(`${BASE}/banner/dismiss`, {}),
};

/** What the server handed this page about CRMs (`subtleformsAdmin.crm`). */
export function pageData() {
  if (typeof window === 'undefined') return { services: {}, extras: [], banner: { show: false, url: '' } };
  const data = window.subtleformsAdmin?.crm || {};
  return {
    services: data.services || {},
    extras: Array.isArray(data.extras) ? data.extras : [],
    banner: data.banner || { show: false, url: '' },
  };
}

/**
 * Whether this plugin's own CRM is the one the Settings list shows. An
 * add-on that lists its own `crm` entry (without `builtin`) takes over, and
 * every CRM screen of this plugin leaves the screen to it.
 *
 * @return {boolean} True when the built-in screens should be drawn.
 */
export function isBuiltInCrm() {
  return window.subtleformsAdmin?.extensions?.crm?.builtin === true;
}

/**
 * Keep the page data and the Settings sidebar dot in step with a change made
 * in a panel.
 *
 * @param {string} service Service slug.
 * @param {Object} change  { enabled, status }: the new switch and/or connection status.
 */
export function announceService(service, change = {}) {
  const data = window.subtleformsAdmin?.crm;
  const entry = data?.services?.[service];
  if (entry) {
    if (typeof change.enabled === 'boolean') entry.enabled = change.enabled;
    if (typeof change.status === 'string') entry.configured = change.status === 'connected';
  }
  const ext = window.subtleformsAdmin?.extensions?.crm;
  if (ext && data?.services) {
    const list = Object.values(data.services).filter((s) => s && s.builtin !== false);
    ext.enabled = list.some((s) => s.enabled);
    ext.configured = list.some((s) => s.enabled && s.configured);
  }
  window.dispatchEvent(new CustomEvent('subtleforms:extension-status'));
}

/**
 * Whether a CRM can send: a token was accepted and its last check did not fail.
 *
 * @param {Object} state Connection state from the server.
 * @return {boolean} True when the service is usable.
 */
export function isConnected(state) {
  if (!state) return false;
  if (typeof state.connected === 'boolean') return state.connected;
  return state.has_key === true && state.status !== 'error';
}
