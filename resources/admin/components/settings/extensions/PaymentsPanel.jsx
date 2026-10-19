import { ToggleControl, TextControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';
import { currencyOptions } from '../../../../shared/currencies';

const PROVIDERS = [
  { label: 'Stripe', value: 'stripe' },
];

const MODES = [
  { label: __('Test / Sandbox', 'subtleforms'), value: 'test' },
  { label: __('Live', 'subtleforms'), value: 'live' },
];

// One list with the form setting and the server (Payments\Currencies).
const CURRENCIES = currencyOptions();

/**
 * Payments Extension Settings Panel
 */
export default function PaymentsPanel({ settings, updateSetting, fieldErrors = {} }) {
  const provider = settings.ext_payments_provider || 'stripe';

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Payments', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Take card, Apple Pay and Google Pay payments through Stripe. Products, order totals and coupons work without a gateway too.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable Payments', 'subtleforms')}
            checked={!!settings.ext_payments_enabled}
            onChange={(v) => updateSetting('ext_payments_enabled', v)}
            help={__('Accept payments through SubtleForms forms.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_payments_enabled} />
        </div>

        {settings.ext_payments_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('Payment Provider', 'subtleforms')}
                value={provider}
                options={PROVIDERS}
                onChange={(v) => updateSetting('ext_payments_provider', v)}
              />
            </div>

            <div className='sf-settings-field'>
              <SelectControl
                label={__('Mode', 'subtleforms')}
                value={settings.ext_payments_mode || 'test'}
                options={MODES}
                onChange={(v) => updateSetting('ext_payments_mode', v)}
                help={__(
                  'Use Test mode for development and Live mode for real transactions.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_payments_mode} />
            </div>

            <div className='sf-settings-field'>
              <SelectControl
                label={__('Currency', 'subtleforms')}
                value={settings.ext_payments_currency || 'USD'}
                options={CURRENCIES}
                onChange={(v) => updateSetting('ext_payments_currency', v)}
              />
              <FieldError errors={fieldErrors.ext_payments_currency} />
            </div>

            <div className='sf-settings-field'>
              <ToggleControl
                label={__('Email me when a payment fails', 'subtleforms')}
                checked={settings.ext_payments_failed_email ?? true}
                onChange={(v) => updateSetting('ext_payments_failed_email', v)}
                help={__(
                  'When the card is declined after the entry is saved, no receipt or notification is sent. This email tells you instead.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_payments_failed_email} />
            </div>

            {provider === 'stripe' && (
              <>
                <div className='sf-settings-field'>
                  <TextControl
                    label={__('Stripe Publishable Key', 'subtleforms')}
                    value={settings.ext_payments_stripe_pk || ''}
                    onChange={(v) => updateSetting('ext_payments_stripe_pk', v)}
                    help={__('Your Stripe publishable key (starts with pk_).', 'subtleforms')}
                  />
                  <FieldError errors={fieldErrors.ext_payments_stripe_pk} />
                </div>

                <div className='sf-settings-field'>
                  <TextControl
                    label={__('Stripe Secret Key', 'subtleforms')}
                    type='password'
                    value={settings.ext_payments_stripe_sk || ''}
                    onChange={(v) => updateSetting('ext_payments_stripe_sk', v)}
                    help={__('Your Stripe secret key (starts with sk_). Never share this publicly.', 'subtleforms')}
                  />
                  <FieldError errors={fieldErrors.ext_payments_stripe_sk} />
                </div>
              </>
            )}

            {provider === 'paypal' && (
              <>
                <div className='sf-settings-field'>
                  <TextControl
                    label={__('PayPal Client ID', 'subtleforms')}
                    value={settings.ext_payments_paypal_client_id || ''}
                    onChange={(v) => updateSetting('ext_payments_paypal_client_id', v)}
                    help={__('Your PayPal REST API Client ID.', 'subtleforms')}
                  />
                  <FieldError errors={fieldErrors.ext_payments_paypal_client_id} />
                </div>

                <div className='sf-settings-field'>
                  <TextControl
                    label={__('PayPal Client Secret', 'subtleforms')}
                    type='password'
                    value={settings.ext_payments_paypal_client_secret || ''}
                    onChange={(v) => updateSetting('ext_payments_paypal_client_secret', v)}
                    help={__('Your PayPal REST API Client Secret. Never share this publicly.', 'subtleforms')}
                  />
                  <FieldError errors={fieldErrors.ext_payments_paypal_client_secret} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
