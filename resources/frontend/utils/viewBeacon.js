/**
 * Form view beacon.
 *
 * Counts one view per form per page load, sent the first time at least 40% of
 * the form is on screen. The request carries no identifiers: no cookies are
 * set, nothing is stored in the browser, and the server only increments a
 * daily counter for the form.
 */

const sent = new Set();

/**
 * Send the view ping for a form (at most once per page load).
 *
 * @param {number} formId Form ID.
 * @param {Object} config Localised frontend config (restUrl, nonce).
 * @return {boolean} Whether a request was sent.
 */
export function sendView(formId, config = {}) {
  if (!formId || sent.has(formId) || !config.restUrl) {
    return false;
  }
  sent.add(formId);

  const url = `${String(config.restUrl).replace(/\/$/, '')}/forms/${formId}/view`;

  try {
    fetch(url, {
      method: 'POST',
      // Same-origin so a logged-in editor's REST nonce validates; the request
      // itself sets no cookies.
      credentials: 'same-origin',
      keepalive: true,
      headers: config.nonce
        ? { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce }
        : { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
  } catch (e) {
    // Analytics must never interfere with the form.
  }
  return true;
}

/**
 * Watch a form container and send the view ping once it is visible.
 *
 * @param {HTMLElement} container Form container.
 * @param {number}      formId    Form ID.
 * @param {Object}      config    Localised frontend config.
 */
export function observeView(container, formId, config = {}) {
  if (!container || !formId || !config.trackViews) {
    return;
  }

  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    sendView(formId, config);
    return;
  }

  const observer = new window.IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        sendView(formId, config);
      }
    },
    { threshold: 0.4 }
  );
  observer.observe(container);
}

/** Test helper: forget which forms were counted. */
export function resetViewBeacon() {
  sent.clear();
}
