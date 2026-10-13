/**
 * Payment defaults for forms that start taking money (2.1).
 *
 * Add-ons put `paymentDefaults` on window.subtleformsAdmin (through the PHP
 * `subtleforms/admin_data` filter), for example `{ processor: 'woocommerce' }`
 * when the WooCommerce checkout is the site's default. They are written into
 * `metadata.payment` the moment a form gets its first priced field, so forms
 * that already take payments never change on their own.
 */
import { isPricedForm } from '../../shared/pricing';

function flatten(fields, out = []) {
  (Array.isArray(fields) ? fields : []).forEach((f) => {
    if (!f || typeof f !== 'object') return;
    out.push(f);
    flatten(f.children, out);
    flatten(f.fields, out);
    (f.columns || []).forEach((col) => Array.isArray(col) && flatten(col, out));
  });
  return out;
}

/**
 * @param {Object|null} prev Schema before the edit.
 * @param {Object}      next Schema after the edit.
 * @param {Object}      [defaults] Defaults (window.subtleformsAdmin.paymentDefaults).
 * @return {Object} `next`, with defaults applied when the form just became priced.
 */
export function applyPaymentDefaults(prev, next, defaults = window.subtleformsAdmin?.paymentDefaults) {
  if (!next || !defaults || typeof defaults !== 'object' || !Object.keys(defaults).length) {
    return next;
  }
  const payment = next.metadata?.payment || {};
  const missing = Object.keys(defaults).filter((k) => payment[k] === undefined);
  if (!missing.length) return next;
  if (!isPricedForm(flatten(next.fields)) || isPricedForm(flatten(prev?.fields))) {
    return next;
  }
  const add = {};
  missing.forEach((k) => {
    add[k] = defaults[k];
  });
  return {
    ...next,
    metadata: { ...(next.metadata || {}), payment: { ...payment, ...add } },
  };
}
