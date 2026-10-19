/**
 * Form settings › Payments › Currency (2.4.0).
 *
 * A form follows the site currency (Settings > Integrations > Payments) until
 * the admin picks one here. The empty value means "site currency" and is not
 * stored, so changing the site setting later still reaches this form.
 */
import { SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { currencyOptions } from '../../../shared/currencies';

export default function FormCurrencyControl({ schema, onPayment, isReadOnly = false }) {
  const site = String(window.subtleformsAdmin?.currency || 'USD').toUpperCase();
  const value = String(schema?.metadata?.payment?.currency || '').toUpperCase();
  const options = [
    {
      value: '',
      /* translators: %s: currency code, for example EUR */
      label: sprintf(__('Site currency (%s)', 'subtleforms'), site),
    },
    ...currencyOptions(),
  ];
  // A stored code that is no longer offered still shows, so it can be changed.
  if (value && !options.some((o) => o.value === value)) {
    options.push({ value, label: value });
  }

  return (
    <SelectControl
      label={__('Currency', 'subtleforms')}
      value={value}
      options={options}
      onChange={(v) => onPayment('currency', v)}
      help={__('Prices on this form are shown and charged in this currency.', 'subtleforms')}
      disabled={isReadOnly}
      __nextHasNoMarginBottom
      __next40pxDefaultSize
    />
  );
}
