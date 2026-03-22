import { ToggleControl, TextControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

const CURRENCIES = [
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
  { label: 'GBP', value: 'GBP' },
  { label: 'CAD', value: 'CAD' },
  { label: 'AUD', value: 'AUD' },
];

/**
 * E-commerce Extension Settings Panel
 */
export default function EcommercePanel({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('E-commerce', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Automatically create WooCommerce orders when a form is submitted. Requires WooCommerce to be installed and active.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable E-commerce', 'subtleforms')}
            checked={!!settings.ext_ecommerce_enabled}
            onChange={(v) => updateSetting('ext_ecommerce_enabled', v)}
            help={__('Create a WooCommerce order on every form submission.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_ecommerce_enabled} />
        </div>

        {settings.ext_ecommerce_enabled && (
          <>
            <div className='sf-settings-field'>
              <TextControl
                label={__('Default Product ID', 'subtleforms')}
                type='number'
                value={String(settings.ext_ecommerce_product_id ?? 0)}
                onChange={(v) => updateSetting('ext_ecommerce_product_id', Number(v))}
                min='0'
                help={__(
                  'The WooCommerce product ID to add to orders created from forms.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_ecommerce_product_id} />
            </div>

            <div className='sf-settings-field'>
              <SelectControl
                label={__('Currency', 'subtleforms')}
                value={settings.ext_ecommerce_currency || 'USD'}
                options={CURRENCIES}
                onChange={(v) => updateSetting('ext_ecommerce_currency', v)}
                help={__(
                  'Currency for new orders. Defaults to the WooCommerce store currency if left as USD.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_ecommerce_currency} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
