import { ToggleControl, RadioControl, ExternalLink } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import FieldError from '../FieldError';
import './EcommercePanel.scss';

const DOCS_URL = 'https://subtleforms.com/docs/woocommerce/';

/**
 * WooCommerce settings (2.1).
 *
 * When WooCommerce is active a site has one checkout: payment forms can hand
 * their order to the WooCommerce cart and checkout, and the WooCommerce Product
 * field sells store products from any form. These are site-wide defaults;
 * each form chooses its checkout under Form settings › Checkout.
 */
export default function EcommercePanel({ settings, updateSetting, fieldErrors = {} }) {
  const woo = window.subtleformsAdmin?.woocommerce || null;

  return (
    <div className='sf-ext-panel sf-woo-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('WooCommerce', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'One checkout for your whole site: payment forms can send their order to the WooCommerce cart, and the WooCommerce Product field sells store products from any form.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-woo-panel__status'>
          <span className={`sf-woo-panel__badge${woo ? ' is-active' : ''}`} aria-hidden='true'>
            {woo ? '✓' : '!'}
          </span>
          <div className='sf-woo-panel__status-text'>
            <strong>
              {woo
                ? sprintf(
                    /* translators: %s: WooCommerce version */
                    __('WooCommerce %s detected', 'subtleforms'),
                    woo.version
                  )
                : __('WooCommerce is not active', 'subtleforms')}
            </strong>
            <span>
              {woo
                ? sprintf(
                    /* translators: 1: currency code, 2: currency symbol */
                    __('Store currency: %1$s (%2$s). Forms that check out through WooCommerce use it.', 'subtleforms'),
                    woo.currency,
                    woo.symbol
                  )
                : __('Install and activate WooCommerce to take form payments through its checkout. Until then, payment forms use the SubtleForms checkout.', 'subtleforms')}
            </span>
          </div>
        </div>

        <div className='sf-settings-field'>
          <RadioControl
            label={__('Checkout for new payment forms', 'subtleforms')}
            selected={settings.ext_ecommerce_default_processor || 'woocommerce'}
            options={[
              {
                label: __('WooCommerce checkout (recommended)', 'subtleforms'),
                value: 'woocommerce',
              },
              {
                label: __('SubtleForms checkout (Card Payment field)', 'subtleforms'),
                value: 'subtleforms',
              },
            ]}
            onChange={(v) => updateSetting('ext_ecommerce_default_processor', v)}
            help={__(
              'Applied when a form gets its first priced field. Each form can change it under Form settings › Checkout.',
              'subtleforms'
            )}
            disabled={!woo}
          />
          <FieldError errors={fieldErrors.ext_ecommerce_default_processor} />
        </div>

        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Empty the cart before adding form items', 'subtleforms')}
            checked={settings.ext_ecommerce_empty_cart !== false}
            onChange={(v) => updateSetting('ext_ecommerce_empty_cart', v)}
            help={__(
              'Visitors check out exactly what they chose in the form. Turn off to add form items to whatever is already in their cart.',
              'subtleforms'
            )}
            disabled={!woo}
          />
          <FieldError errors={fieldErrors.ext_ecommerce_empty_cart} />
        </div>

        <div className='sf-settings-field'>
          <RadioControl
            label={__('After the form is sent, take visitors to', 'subtleforms')}
            selected={settings.ext_ecommerce_destination || 'checkout'}
            options={[
              { label: __('Checkout', 'subtleforms'), value: 'checkout' },
              { label: __('Cart', 'subtleforms'), value: 'cart' },
            ]}
            onChange={(v) => updateSetting('ext_ecommerce_destination', v)}
            disabled={!woo}
          />
          <FieldError errors={fieldErrors.ext_ecommerce_destination} />
        </div>

        <div className='sf-woo-panel__notes'>
          <ul>
            <li>
              {__('Prices for WooCommerce products always come from your store, never from the browser.', 'subtleforms')}
            </li>
            <li>
              {__('Forms that use the WooCommerce checkout validate WooCommerce coupons, and the code is applied to the cart.', 'subtleforms')}
            </li>
            <li>
              {__('Entries link to their order, and the entry is marked paid when the order is processing or completed.', 'subtleforms')}
            </li>
          </ul>
          <ExternalLink href={DOCS_URL}>{__('Read the WooCommerce guide', 'subtleforms')}</ExternalLink>
        </div>
      </div>
    </div>
  );
}
