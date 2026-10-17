/**
 * Form settings › Checkout (2.1).
 *
 * Shown when WooCommerce is active and the form takes money. The form chooses
 * who takes the payment (`metadata.payment.processor`): the WooCommerce
 * checkout or SubtleForms (Card Payment field). For WooCommerce, the visitor's
 * answers can fill the checkout's billing details (`metadata.payment.billing`).
 *
 * The WooCommerce checkout is a Pro feature (`integrations.woocommerce`);
 * without it the choice is shown locked with an upgrade prompt.
 */
import { PanelBody, RadioControl, SelectControl, Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { isProFeature, openUpgradeModal } from '../../utils/featureGate';
import Icon from '../../ui/Icon';

const BILLING_FIELDS = [
  { id: 'email', label: () => __('Email', 'subtleforms'), types: ['email'] },
  { id: 'name', label: () => __('Name', 'subtleforms'), types: ['name_group', 'text'] },
  { id: 'last_name', label: () => __('Last name (if separate)', 'subtleforms'), types: ['text'] },
  { id: 'phone', label: () => __('Phone', 'subtleforms'), types: ['phone', 'tel', 'text'] },
  { id: 'company', label: () => __('Company', 'subtleforms'), types: ['text'] },
  { id: 'address', label: () => __('Address', 'subtleforms'), types: ['address_group', 'text', 'textarea'] },
];

/** Flatten schema fields to { key, type, label }. */
function flatten(fields = [], out = []) {
  fields.forEach((f) => {
    if (!f || typeof f !== 'object') return;
    const c = f.config || {};
    const key = c.key || f.key;
    if (key && f.type) out.push({ key, type: f.type, label: c.label || f.label || key });
    ['fields', 'children'].forEach((k) => Array.isArray(f[k]) && flatten(f[k], out));
    if (Array.isArray(f.columns)) f.columns.forEach((col) => Array.isArray(col) && flatten(col, out));
  });
  return out;
}

/**
 * The field each billing detail is read from when the form has no explicit
 * choice. Mirrors SubtleFormsPro\Modules\WooCommerce\Billing::detect().
 */
export function detectBillingFields(list) {
  const byType = (types) => list.find((f) => types.includes(f.type));
  const nameText = list.find((f) => f.type === 'text' && /(^|_)(full_?)?name$|^name|your_name|first_name/i.test(f.key));
  return {
    email: byType(['email'])?.key || '',
    name: byType(['name_group'])?.key || nameText?.key || '',
    last_name: list.find((f) => f.type === 'text' && /last_?name|surname/i.test(f.key))?.key || '',
    phone: byType(['phone', 'tel'])?.key || '',
    company: list.find((f) => f.type === 'text' && /company|organi[sz]ation/i.test(f.key))?.key || '',
    address: byType(['address_group'])?.key || '',
  };
}

export default function CheckoutPanel({ schema, fields: pricedFields = [], onPayment, isReadOnly }) {
  const woo = window.subtleformsAdmin?.woocommerce;
  if (!woo) return null;

  const payment = schema?.metadata?.payment || {};
  const allowed = isProFeature('integrations.woocommerce');
  const processor = payment.processor || 'subtleforms';
  const list = flatten(schema?.fields || []);
  const detected = detectBillingFields(list);
  const billing = payment.billing || {};
  const hasCard = list.some((f) => f.type === 'payment_card');

  const setBilling = (id, value) => onPayment('billing', { ...billing, [id]: value });

  return (
    <PanelBody title={__('Checkout', 'subtleforms')} initialOpen={true}>
      <div className='sf-form-settings__section sf-checkout-panel'>
        <RadioControl
          label={__('Take payments through', 'subtleforms')}
          selected={allowed ? processor : 'subtleforms'}
          options={[
            {
              label: __('WooCommerce checkout', 'subtleforms'),
              value: 'woocommerce',
              description: __('Visitors go to your store checkout after sending the form, with their choices in the cart.', 'subtleforms'),
            },
            {
              label: __('SubtleForms', 'subtleforms'),
              value: 'subtleforms',
              description: __('Visitors pay on the form with the Card Payment field.', 'subtleforms'),
            },
          ]}
          onChange={(value) => {
            if (!allowed) {
              openUpgradeModal('integrations.woocommerce', { label: __('WooCommerce checkout', 'subtleforms') });
              return;
            }
            onPayment('processor', value);
          }}
          disabled={isReadOnly}
        />

        {!allowed && (
          <div className='sf-checkout-panel__upgrade'>
            <Icon.Lock size={14} aria-hidden='true' />
            <span>{__('The WooCommerce checkout comes with SubtleForms Pro.', 'subtleforms')}</span>
            <Button
              variant='link'
              onClick={() => openUpgradeModal('integrations.woocommerce', { label: __('WooCommerce checkout', 'subtleforms') })}>
              {__('Upgrade', 'subtleforms')}
            </Button>
          </div>
        )}

        {allowed && processor === 'woocommerce' && (
          <>
            <p className='sf-form-settings__hint'>
              {sprintf(
                /* translators: %s: currency code */
                __('Prices are charged in your store currency (%s). Coupons entered on this form are WooCommerce coupons.', 'subtleforms'),
                woo.currency
              )}
              {hasCard && ' ' + __('The Card Payment field is not used with this checkout; you can remove it.', 'subtleforms')}
              {pricedFields.length === 0 && ' ' + __('Add a WooCommerce Product or another priced field to build the order.', 'subtleforms')}
            </p>

            <div className='sf-checkout-panel__billing'>
              <h4 className='sf-form-settings__integration-title'>{__('Billing details from', 'subtleforms')}</h4>
              <p className='sf-form-settings__hint'>
                {__('These answers fill in the checkout so visitors do not type them twice.', 'subtleforms')}
              </p>
              <div className='sf-checkout-panel__grid'>
                {BILLING_FIELDS.map((b) => {
                  const options = list.filter((f) => b.types.includes(f.type));
                  const auto = detected[b.id];
                  const autoLabel = auto
                    ? sprintf(
                        /* translators: %s: field label */
                        __('Automatic (%s)', 'subtleforms'),
                        list.find((f) => f.key === auto)?.label || auto
                      )
                    : __('Automatic (none found)', 'subtleforms');
                  return (
                    <SelectControl
                      key={b.id}
                      label={b.label()}
                      value={billing[b.id] ?? ''}
                      options={[
                        { value: '', label: autoLabel },
                        ...options.map((f) => ({ value: f.key, label: f.label })),
                        { value: '-', label: __('Do not fill', 'subtleforms') },
                      ]}
                      onChange={(v) => setBilling(b.id, v)}
                      disabled={isReadOnly}
                      __nextHasNoMarginBottom
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </PanelBody>
  );
}
