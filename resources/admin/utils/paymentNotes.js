/**
 * Builder notes about how a payment form takes money (PAY-03).
 */
import { __ } from '@wordpress/i18n';
import { isPricedForm } from '../../shared/pricing';

/**
 * Every field in a schema, at any depth.
 *
 * @param {Array} fields Field nodes.
 * @param {Array} out    Collected fields.
 * @return {Array} Fields.
 */
function flatten(fields, out = []) {
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field || typeof field !== 'object') return;
    out.push(field);
    flatten(field.children || field.fields, out);
    if (Array.isArray(field.columns)) {
      field.columns.forEach((column) =>
        flatten(Array.isArray(column) ? column : column?.fields || column?.children, out)
      );
    }
  });
  return out;
}

/**
 * The note to show when a priced form has no Card Payment field, or ''.
 *
 * @param {Object} schema Form schema.
 * @return {string} Note.
 */
export function offlinePaymentNote(schema) {
  if (!schema) return '';
  if (schema.metadata?.payment?.processor === 'woocommerce') return '';
  const fields = flatten(schema.fields);
  if (!isPricedForm(fields) || fields.some((f) => f.type === 'payment_card')) return '';
  return __(
    'This form has prices but no Card Payment field, so entries are saved as "Payment pending" and you collect payment yourself. Add a Card Payment field (SubtleForms Pro) to take card payments online.',
    'subtleforms'
  );
}
