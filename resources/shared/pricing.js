/**
 * Live order maths for payment forms.
 *
 * Mirrors SubtleForms\Payments\Pricing on the server so the summary updates as
 * the visitor types. The server recomputes everything on submit, so this is
 * only ever used for display.
 */

import { getPricedType, chargesMoney } from './extend';
import { computeLogicState, nodeLogics, logicPasses, visibleValues } from './conditions';
import { currencyDecimals, roundMoney } from './currencies';

export const PRICED_TYPES = [
  'payment_product',
  'payment_choice',
  'payment_amount',
  'payment_hidden_price',
];

/**
 * Whether a field type adds lines to the order, including types that add-ons
 * register with registerPricedType().
 */
export const isPricedType = (type) => PRICED_TYPES.includes(type) || !!getPricedType(type);

export { registerPricedType } from './extend';

// Prices round to what the currency can charge: whole yen, cents (PAY-12).
const money = (v, currency = 'USD') => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? roundMoney(n, currency) : 0;
};

const cfg = (f) => ({ ...f, ...(f?.config || {}) });

/**
 * Whether a list of fields charges money.
 *
 * @param {Array} fields Flattened fields.
 */
export function isPricedForm(fields = []) {
  return fields.some((f) => {
    const c = cfg(f);
    if (['payment_product', 'payment_choice', 'payment_amount', 'payment_hidden_price', 'payment_card'].includes(f.type)) {
      return true;
    }
    return chargesMoney(f.type, c);
  });
}

/**
 * Which fields of a schema do not count for these answers: fields hidden by
 * conditional logic, and every field inside a hidden container or a skipped
 * step. Mirrors Pricing::visibleFields() on the server.
 *
 * @param {Object} schema { fields, logic }.
 * @param {Object} values Answers keyed by field key.
 * @return {{keys: Set<string>, nodes: Set<Object>}} Hidden keys and hidden nodes.
 */
export function hiddenPricing(schema, values = {}) {
  const keys = new Set();
  const nodes = new Set();
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  if (!fields.length) return { keys, nodes };
  const state = computeLogicState(schema, values);
  const hidden = new Set([...state.hidden_fields, ...state.hidden_steps]);
  const visible = visibleValues(schema, values);

  const walk = (list, parentHidden) => {
    (Array.isArray(list) ? list : []).forEach((node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const c = cfg(node);
      const key = c.key || (node.type === 'step' ? node.id : '') || '';
      let isHidden = parentHidden;
      if (key) {
        isHidden = isHidden || hidden.has(key);
      } else {
        nodeLogics(node).forEach((l) => {
          const passes = logicPasses(l, visible);
          if ((l.action === 'show' && !passes) || (l.action === 'hide' && passes)) isHidden = true;
        });
      }
      if (isHidden) {
        nodes.add(node);
        if (key) keys.add(key);
      }
      walk(node.children, isHidden);
      walk(node.fields, isHidden);
      (Array.isArray(node.columns) ? node.columns : []).forEach((col) => {
        if (Array.isArray(col)) walk(col, isHidden);
        else if (col && typeof col === 'object') walk(col.fields || col.children, isHidden);
      });
    });
  };
  walk(fields, false);
  return { keys, nodes };
}

/**
 * Discount a coupon gives on a subtotal.
 */
export function couponDiscount(coupon, subtotal, currency = 'USD') {
  if (!coupon) return 0;
  const amount = Number(coupon.amount) || 0;
  const off = coupon.type === 'percent' ? (subtotal * amount) / 100 : amount;
  return roundMoney(Math.round(Math.min(subtotal, Math.max(0, off)) * 100) / 100, currency);
}

/**
 * Build the order from fields and values.
 *
 * @param {Array}  fields  Flattened fields.
 * @param {Object} values  Current values keyed by field key.
 * @param {Object} options { coupon, schema, hidden: Set of hidden keys, currency }.
 *                         With `schema`, which fields count is worked out from
 *                         its conditional logic, as on the server.
 */
export function computeQuote(fields = [], values = {}, { coupon = null, schema = null, hidden = null, currency = 'USD' } = {}) {
  const items = [];
  const byLogic = schema ? hiddenPricing(schema, values) : null;
  let taxRate = 0;
  let taxLabel = '';
  let formulaError = false;
  const working = { ...values };

  fields.forEach((field) => {
    const c = cfg(field);
    const key = c.key || field.key || '';
    if (hidden && key && hidden.has(key)) return;
    if (byLogic && (byLogic.nodes.has(field) || (key && byLogic.keys.has(key)))) return;
    const label = c.label || key;
    const value = key ? working[key] : undefined;

    switch (field.type) {
      case 'payment_product': {
        const price = money(c.price, currency);
        let qty;
        if (c.allowQuantity) {
          qty = parseInt(value, 10) || 0;
          qty = Math.max(Math.max(0, parseInt(c.minQuantity, 10) || 0), qty);
          const max = parseInt(c.maxQuantity, 10) || 0;
          if (max > 0) qty = Math.min(max, qty);
        } else {
          // No visitor control: in every order it is shown in.
          qty = 1;
        }
        if (qty > 0 && price > 0) {
          items.push({ key, label: c.productName || label, qty, unit: price, amount: roundMoney(qty * price, currency) });
        }
        break;
      }
      case 'payment_choice': {
        const selected = Array.isArray(value)
          ? value.map(String)
          : value === undefined || value === null || value === ''
          ? []
          : String(value).split(',').map((s) => s.trim());
        (c.options || []).forEach((opt) => {
          if (!selected.includes(String(opt.value))) return;
          const price = money(opt.price, currency);
          if (price > 0) {
            items.push({ key, label: `${label}: ${opt.label}`, qty: 1, unit: price, amount: price });
          }
        });
        break;
      }
      case 'payment_amount': {
        let amount = money(value, currency);
        if (amount > 0 && c.min !== undefined && c.min !== '' && c.min !== null) amount = Math.max(money(c.min, currency), amount);
        if (Number(c.max) > 0) amount = Math.min(money(c.max, currency), amount);
        if (amount > 0) items.push({ key, label, qty: 1, unit: amount, amount });
        break;
      }
      case 'payment_hidden_price': {
        const amount = money(c.amount, currency);
        if (amount > 0) items.push({ key, label: c.description || label, qty: 1, unit: amount, amount });
        break;
      }
      case 'payment_summary':
        if (c.showTax && Number(c.taxRate) > 0) {
          taxRate = Math.min(100, Number(c.taxRate));
          taxLabel = c.taxLabel || '';
        }
        break;
      default: {
        // Add-on priced types (e.g. a WooCommerce Product field).
        const fn = getPricedType(field.type);
        if (!fn) break;
        if (!chargesMoney(field.type, c)) break;
        let lines = [];
        try {
          lines = fn(c, value, { currency }) || [];
        } catch (e) {
          lines = [];
        }
        if (lines && lines.error) {
          formulaError = true;
          break;
        }
        (Array.isArray(lines) ? lines : []).forEach((line) => {
          const qty = Math.max(0, parseInt(line.qty, 10) || 0);
          const unit = money(line.unit, currency);
          if (qty > 0 && unit > 0) {
            items.push({ key, label: line.label || label, qty, unit, amount: roundMoney(qty * unit, currency) });
          }
        });
      }
    }
  });

  const subtotal = roundMoney(items.reduce((s, i) => s + i.amount, 0), currency);
  const discount = couponDiscount(coupon, subtotal, currency);
  const taxable = Math.max(0, subtotal - discount);
  const tax = roundMoney((taxable * taxRate) / 100, currency);
  const total = roundMoney(taxable + tax, currency);

  return { currency, items, subtotal, discount, coupon: coupon?.code || null, taxRate, taxLabel, tax, total, formulaError };
}

/**
 * Format an amount in a currency for the visitor's locale.
 */
export function formatMoney(amount, currency = 'USD') {
  const digits = currencyDecimals(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number(amount) || 0);
  } catch (e) {
    return `${currency} ${(Number(amount) || 0).toFixed(digits)}`;
  }
}
