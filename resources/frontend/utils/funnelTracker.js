/**
 * Form completion funnel (2.6.0).
 *
 * Notes where a visitor stops filling in a form: when someone who started the
 * form leaves the page without sending it, one beacon reports the key of the
 * last field they touched and the step they were on. Nothing else is sent:
 * never a value, no cookie, nothing kept in the browser. Submissions are
 * counted on the server from the real entries, so a sent form sends nothing.
 *
 * Listeners are passive and do no work until the visitor touches the form.
 */

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|preview/i;

/** Event the renderers fire on the document after a form is sent. */
export const SUBMITTED_EVENT = 'subtleforms:submitted';

/**
 * Tell the tracker that a form was sent (the renderers call this).
 *
 * @param {number}   formId Form ID.
 * @param {Document} doc    Document, for tests.
 */
export function announceSubmitted(formId, doc = document) {
  try {
    doc.dispatchEvent(new CustomEvent(SUBMITTED_EVENT, { detail: { formId: Number(formId) } }));
  } catch (e) {
    // Never let statistics break the confirmation.
  }
}

/**
 * Key of the outermost field around a node, inside the form container.
 *
 * @param {Element} node      Event target.
 * @param {Element} container Form container.
 * @return {string} Field key, or ''.
 */
export function fieldKeyOf(node, container) {
  let key = '';
  for (let el = node; el && el !== container; el = el.parentElement) {
    if (el.dataset && el.dataset.sfKey) {
      key = el.dataset.sfKey;
    }
  }
  return key;
}

/**
 * Step index around a node, or -1 for a form without steps.
 *
 * @param {Element} node Event target.
 * @return {number} Step index.
 */
export function stepOf(node) {
  const el = node && node.closest ? node.closest('[data-sf-step]') : null;
  const step = el ? parseInt(el.getAttribute('data-sf-step'), 10) : -1;
  return step >= 0 ? step : -1;
}

/**
 * Start watching one form.
 *
 * @param {HTMLElement} container Form container.
 * @param {number}      formId    Form ID.
 * @param {Object}      config    Localised frontend config (restUrl, trackFunnel).
 * @param {Window}      win       Window, for tests.
 * @return {Object|null} Handle with flush() and state(), or null when off.
 */
export function trackFunnel(container, formId, config = {}, win = window) {
  const nav = win.navigator || {};
  if (
    !container ||
    !formId ||
    !config.trackFunnel ||
    !config.restUrl ||
    (typeof win.fetch !== 'function' && typeof nav.sendBeacon !== 'function') ||
    BOT.test(nav.userAgent || '')
  ) {
    return null;
  }

  const doc = win.document;
  const url = `${String(config.restUrl).replace(/\/$/, '')}/forms/${formId}/funnel`;
  const passive = { passive: true };
  // started: touched the form. sending: a submit is on its way. sent: the
  // field|step already reported from this page.
  let started = false;
  let sending = false;
  let field = '';
  let step = -1;
  let sent = null;

  const beacon = (params) => {
    try {
      const body = new win.URLSearchParams(params);
      if (typeof win.fetch === 'function') {
        // Prefer fetch keepalive so the body is form-urlencoded (WP REST
        // parses it) and Playwright can observe the request.
        win
          .fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            keepalive: true,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body,
          })
          .catch(() => {});
        return;
      }
      if (typeof nav.sendBeacon === 'function') {
        const payload =
          typeof win.Blob === 'function'
            ? new win.Blob([body.toString()], { type: 'application/x-www-form-urlencoded' })
            : body;
        nav.sendBeacon(url, payload);
      }
    } catch (e) {
      // Statistics must never interfere with the form.
    }
  };

  const touch = (event) => {
    started = true;
    sending = false;
    const key = fieldKeyOf(event.target, container);
    if (key) {
      field = key;
      step = stepOf(event.target);
    }
  };

  const flush = () => {
    if (!started || sending) {
      return;
    }
    const now = `${field}|${step}`;
    if (sent === now) {
      return;
    }
    const params = { a: 'drop', f: field, s: String(step) };
    if (sent !== null) {
      const [pf, ps] = sent.split('|');
      Object.assign(params, { a: 'move', pf, ps });
    }
    sent = now;
    beacon(params);
  };

  const submitted = (event) => {
    if (Number(event.detail && event.detail.formId) !== Number(formId)) {
      return;
    }
    if (sent !== null) {
      // Reported as gone, then came back and sent the form.
      const [pf, ps] = sent.split('|');
      beacon({ a: 'undo', pf, ps });
    }
    started = false;
    sending = false;
    field = '';
    step = -1;
    sent = null;
  };

  container.addEventListener('focusin', touch, passive);
  container.addEventListener('input', touch, passive);
  container.addEventListener('change', touch, passive);
  // A classic post leaves the page on purpose; an AJAX submit that fails
  // puts focus back in a field, which counts as a touch again.
  container.addEventListener(
    'submit',
    () => {
      sending = true;
    },
    passive
  );
  doc.addEventListener(SUBMITTED_EVENT, submitted);
  win.addEventListener('pagehide', flush, passive);
  doc.addEventListener(
    'visibilitychange',
    () => {
      if (doc.visibilityState === 'hidden') {
        flush();
      }
    },
    passive
  );

  return {
    flush,
    state: () => ({ started, sending, field, step, sent }),
  };
}
