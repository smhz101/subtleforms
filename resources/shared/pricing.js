/**
 * Live order maths for payment forms.
 *
 * Mirrors SubtleForms\Payments\Pricing on the server so the summary updates as
 * the visitor types. The server recomputes everything on submit, so this is
 * only ever used for display.
 */

import { getPricedType, chargesMoney } from './extend';

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

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
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
 * Discount a coupon gives on a subtotal.
 */
export function couponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  const amount = Number(coupon.amount) || 0;
  const off = coupon.type === 'percent' ? (subtotal * amount) / 100 : amount;
  return Math.round(Math.min(subtotal, Math.max(0, off)) * 100) / 100;
}

/**
 * Build the order from fields and values.
 *
 * @param {Array}  fields  Flattened fields.
 * @param {Object} values  Current values keyed by field key.
 * @param {Object} options { coupon, hidden: Set of hidden keys, currency }.
 */
export function computeQuote(fields = [], values = {}, { coupon = null, hidden = null, currency = 'USD' } = {}) {
  const items = [];
  let taxRate = 0;
  let taxLabel = '';
  let formulaError = false;
  const working = { ...values };

  fields.forEach((field) => {
    const c = cfg(field);
    const key = c.key || field.key || '';
    if (hidden && key && hidden.has(key)) return;
    const label = c.label || key;
    const value = key ? working[key] : undefined;

    switch (field.type) {
      case 'payment_product': {
        const price = money(c.price);
        let qty;
        if (c.allowQuantity) {
          qty = parseInt(value, 10) || 0;
          qty = Math.max(Math.max(0, parseInt(c.minQuantity, 10) || 0), qty);
          const max = parseInt(c.maxQuantity, 10) || 0;
          if (max > 0) qty = Math.min(max, qty);
        } else {
          qty = 1;
        }
        if (qty > 0 && price > 0) {
          items.push({ key, label: c.productName || label, qty, unit: price, amount: Math.round(qty * price * 100) / 100 });
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
          const price = money(opt.price);
          if (price > 0) {
            items.push({ key, label: `${label}: ${opt.label}`, qty: 1, unit: price, amount: price });
          }
        });
        break;
      }
      case 'payment_amount': {
        let amount = money(value);
        if (amount > 0 && c.min !== undefined && c.min !== '' && c.min !== null) amount = Math.max(Number(c.min), amount);
        if (Number(c.max) > 0) amount = Math.min(Number(c.max), amount);
        if (amount > 0) items.push({ key, label, qty: 1, unit: amount, amount });
        break;
      }
      case 'payment_hidden_price': {
        const amount = money(c.amount);
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
          const unit = money(line.unit);
          if (qty > 0 && unit > 0) {
            items.push({ key, label: line.label || label, qty, unit, amount: Math.round(qty * unit * 100) / 100 });
          }
        });
      }
    }
  });

  const subtotal = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const discount = couponDiscount(coupon, subtotal);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * taxRate) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  return { currency, items, subtotal, discount, coupon: coupon?.code || null, taxRate, taxLabel, tax, total, formulaError };
}

/**
 * Format an amount in a currency for the visitor's locale.
 */
export function formatMoney(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount) || 0);
  } catch (e) {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
}
