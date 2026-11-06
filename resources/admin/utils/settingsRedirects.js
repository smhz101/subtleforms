import { registerSettingsRedirect, settingsRedirects } from '../../shared/extend';

// The activity, webhook and API logs moved from Tools to Logs.
registerSettingsRedirect({ tab: 'tools', section: ['activity', 'webhooks', 'api'] }, { tab: 'logs' });

const matches = (wanted, actual) => (Array.isArray(wanted) ? wanted.includes(actual) : wanted === actual);

/**
 * The address a Settings address should become, or null when it stays.
 *
 * @param {string} hash Address hash, with or without the leading #.
 * @return {string|null} New hash without the #, or null.
 */
export function redirectedHash(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  for (const { from, to } of settingsRedirects()) {
    if (Object.keys(from).every((key) => matches(from[key], params.get(key)))) {
      const next = new URLSearchParams(params);
      Object.keys(to).forEach((key) => next.set(key, to[key]));
      return next.toString();
    }
  }
  return null;
}

/**
 * Rewrite the address in the browser when it points at a screen that moved.
 *
 * @return {boolean} Whether the address changed.
 */
export function applySettingsRedirects() {
  try {
    const next = redirectedHash(window.location.hash);
    if (next !== null && next !== window.location.hash.replace(/^#/, '')) {
      window.history.replaceState(null, '', `#${next}`);
      return true;
    }
  } catch (e) {
    // The address is only a convenience.
  }
  return false;
}
