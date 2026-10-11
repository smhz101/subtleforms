import {
  SelectControl,
  TextControl,
  ToggleControl,
  Panel,
  PanelBody,
  RadioControl,
  Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ActionsPanel from './ActionsPanel';
import { ConfirmationPanel, AvailabilityPanel } from './FormBehaviorPanels';
import CheckoutPanel from './CheckoutPanel';
import IntegrationsPanel from './IntegrationsPanel';
import { isPricedForm, isPricedType } from '../../../shared/pricing';
import './FormSettings.scss';

/**
 * FormSettings - Configure form-wide settings including payment options
 */
export default function FormSettings({ 
  schema, 
  onChange, 
  validationErrors = [], 
  fieldErrors = {}, 
  isReadOnly = false 
}) {
  const metadata = schema?.metadata || {};
  const formType = metadata.type || 'regular';
  const isPaymentForm = formType === 'payment';
  const isConversationalForm = formType === 'conversational';
  // Both spellings reach this component: stored schemas may hold either, and
  // normalisation happens on save rather than on every read.
  const isMultiStep = formType === 'multi-step' || formType === 'multistep';
  const supportsPayment = isPaymentForm || isConversationalForm;

  // Payment settings
  const paymentSettings = metadata.payment || {
    enabled: isPaymentForm ? true : false, // Payment forms have payment enabled by default
    mode: 'test',
    currency: 'USD',
    amountType: 'fixed',
    fixedAmount: '',
    amountField: '',
  };

  const handleMetadataChange = (key, value) => {
    if (isReadOnly) return;
    const updated = {
      ...schema,
      metadata: {
        ...metadata,
        [key]: value,
      },
    };
    onChange(updated);
  };

  const handlePaymentSettingChange = (key, value) => {
    if (isReadOnly) return;
    const updated = {
      ...schema,
      metadata: {
        ...metadata,
        payment: {
          ...paymentSettings,
          [key]: value,
        },
      },
    };
    onChange(updated);
  };

  // Checkout settings (2.1) merge into whatever payment settings exist,
  // without the legacy defaults above (they would pin the currency).
  const handleCheckoutChange = (key, value) => {
    if (isReadOnly) return;
    onChange({
      ...schema,
      metadata: {
        ...metadata,
        payment: {
          ...(metadata.payment || {}),
          [key]: value,
        },
      },
    });
  };

  const flatFields = (() => {
    const out = [];
    const walk = (list) =>
      (Array.isArray(list) ? list : []).forEach((f) => {
        if (!f || typeof f !== 'object') return;
        out.push(f);
        walk(f.children);
        walk(f.fields);
        (f.columns || []).forEach((col) => Array.isArray(col) && walk(col));
      });
    walk(schema?.fields);
    return out;
  })();
  const pricedFields = flatFields.filter((f) => isPricedType(f.type));
  const takesMoney = isPricedForm(flatFields) || supportsPayment;

  // Get all numeric/text fields for amount selection
  const amountFieldOptions = () => {
    if (!schema?.fields) return [];

    const flatten = (fields) => {
      let result = [];
      fields.forEach((field) => {
        // Only include numeric and text fields
        if (field.type === 'number' || field.type === 'text') {
          const key = field.config?.key || field.key;
          const label = field.config?.label || key;
          result.push({ label, value: key });
        }
        if (field.children && Array.isArray(field.children)) {
          result = result.concat(flatten(field.children));
        }
        if (field.columns && Array.isArray(field.columns)) {
          field.columns.forEach((col) => {
            if (Array.isArray(col)) {
              result = result.concat(flatten(col));
            }
          });
        }
      });
      return result;
    };

    return flatten(schema.fields);
  };

  const fieldOptions = amountFieldOptions();

  return (
    <div className='subtleforms-form-settings sf-form-settings'>
      <div className='sf-form-settings__container'>
        <h2 className='sf-form-settings__title'>
          {__('Form Settings', 'subtleforms')}
        </h2>

        {/* Read-only Notice */}
        {isReadOnly && (
          <Notice status='info' isDismissible={false}>
            <p>{__('Settings are read-only: Activate your Pro license to edit. Your form continues working. No data loss.', 'subtleforms')}</p>
          </Notice>
        )}

        {/* Form Type Info Banner */}
        {formType !== 'regular' && (
          <div className='sf-form-type-banner' data-form-type={formType}>
            <h3 className='sf-form-type-banner__title'>
              {isMultiStep && __('Multi-step Form', 'subtleforms')}
              {formType === 'sectioned' && __('Sectioned Form', 'subtleforms')}
              {formType === 'conversational' &&
                __('Conversational Form', 'subtleforms')}
              {formType === 'payment' && __('Payment Form', 'subtleforms')}
            </h3>
            <p className='sf-form-type-banner__description'>
              {isMultiStep &&
                __(
                  'Fields are organized into steps. Users navigate through one step at a time with progress tracking.',
                  'subtleforms'
                )}
              {formType === 'sectioned' &&
                __(
                  'Fields are grouped into collapsible sections. All sections are visible on a single page.',
                  'subtleforms'
                )}
              {formType === 'conversational' &&
                __(
                  'Questions are presented one at a time. After completing all questions, users review answers before submitting.',
                  'subtleforms'
                )}
              {formType === 'payment' &&
                __(
                  'This form collects payment information. Configure payment settings below to enable transactions.',
                  'subtleforms'
                )}
            </p>
          </div>
        )}

        {/* One Panel, many PanelBody: that is what makes them an accordion.
            Each body previously had its own Panel, which produced a column of
            separately-bordered boxes that never collapsed as a group. */}
        <Panel>
          <PanelBody
            title={__('General', 'subtleforms')}
            initialOpen={true}>
            <TextControl
                label={__('Form name', 'subtleforms')}
                value={metadata.title || ''}
                onChange={(value) => handleMetadataChange('title', value)}
                help={__(
                  'The name shown to you and your visitors for this form.',
                  'subtleforms'
                )}
              />
            <TextControl
                label={__('Description', 'subtleforms')}
                value={metadata.description || ''}
                onChange={(value) => handleMetadataChange('description', value)}
                help={__(
                  'Shown under the title when the block or shortcode displays it.',
                  'subtleforms'
                )}
              />
          </PanelBody>

          <ConfirmationPanel
            schema={schema}
            onMetadata={handleMetadataChange}
            isReadOnly={isReadOnly}
          />

          <PanelBody
            title={__('Notifications & actions', 'subtleforms')}
            initialOpen={false}>
            <ActionsPanel
              schema={schema}
              onChange={onChange}
              isReadOnly={isReadOnly}
            />
          </PanelBody>

          <AvailabilityPanel
            schema={schema}
            onMetadata={handleMetadataChange}
            isReadOnly={isReadOnly}
          />

          {/* Payments — only for form types that can collect them. */}
          {supportsPayment && (
            <PanelBody
              title={__('Payments', 'subtleforms')}
              initialOpen={false}>
              <div className='sf-form-settings__section'>
                {isConversationalForm && (
                  <div className='sf-info-box sf-info-box--blue'>
                    <p className='sf-info-box__text'>
                      <strong>
                        {__('Conversational Payment:', 'subtleforms')}
                      </strong>{' '}
                      {__(
                        'When enabled, users will answer questions, review their answers, and then complete payment before submission.',
                        'subtleforms'
                      )}
                    </p>
                  </div>
                )}

                {isPaymentForm && (
                  <div className='sf-info-box sf-info-box--blue'>
                    <p className='sf-info-box__text'>
                      <strong>{__('Note:', 'subtleforms')}</strong>{' '}
                      {__(
                        'Payment gateway integration will be added in a future update. These settings prepare your form for payment processing.',
                        'subtleforms'
                      )}
                    </p>
                  </div>
                )}

                <ToggleControl
                  label={__('Enable Payments', 'subtleforms')}
                  checked={paymentSettings.enabled}
                  onChange={(value) =>
                    handlePaymentSettingChange('enabled', value)
                  }
                  help={__(
                    'Require payment for form submission',
                    'subtleforms'
                  )}
                />

                {paymentSettings.enabled && (
                  <>
                    <RadioControl
                      label={__('Payment Mode', 'subtleforms')}
                      selected={paymentSettings.mode}
                      options={[
                        {
                          label: __('Test Mode', 'subtleforms'),
                          value: 'test',
                        },
                        {
                          label: __('Live Mode', 'subtleforms'),
                          value: 'live',
                        },
                      ]}
                      onChange={(value) =>
                        handlePaymentSettingChange('mode', value)
                      }
                      help={__(
                        'Test mode will not process real payments',
                        'subtleforms'
                      )}
                    />

                    <SelectControl
                      label={__('Currency', 'subtleforms')}
                      value={paymentSettings.currency}
                      options={[
                        { label: 'USD - US Dollar', value: 'USD' },
                        { label: 'EUR - Euro', value: 'EUR' },
                        { label: 'GBP - British Pound', value: 'GBP' },
                        { label: 'CAD - Canadian Dollar', value: 'CAD' },
                        { label: 'AUD - Australian Dollar', value: 'AUD' },
                        { label: 'JPY - Japanese Yen', value: 'JPY' },
                        { label: 'INR - Indian Rupee', value: 'INR' },
                      ]}
                      onChange={(value) =>
                        handlePaymentSettingChange('currency', value)
                      }
                      help={__(
                        'Currency for payment transactions',
                        'subtleforms'
                      )}
                    />

                    <RadioControl
                      label={__('Amount Type', 'subtleforms')}
                      selected={paymentSettings.amountType}
                      options={[
                        {
                          label: __('Fixed Amount', 'subtleforms'),
                          value: 'fixed',
                        },
                        {
                          label: __('From Field', 'subtleforms'),
                          value: 'field',
                        },
                      ]}
                      onChange={(value) =>
                        handlePaymentSettingChange('amountType', value)
                      }
                      help={__(
                        'Set a fixed amount or use a field value',
                        'subtleforms'
                      )}
                    />

                    {paymentSettings.amountType === 'fixed' && (
                      <TextControl
                        label={__('Fixed Amount', 'subtleforms')}
                        type='number'
                        step='0.01'
                        min='0'
                        value={paymentSettings.fixedAmount}
                        onChange={(value) =>
                          handlePaymentSettingChange('fixedAmount', value)
                        }
                        help={__(
                          'The amount to charge (e.g., 29.99)',
                          'subtleforms'
                        )}
                      />
                    )}

                    {paymentSettings.amountType === 'field' && (
                      <SelectControl
                        label={__('Amount Field', 'subtleforms')}
                        value={paymentSettings.amountField}
                        options={[
                          {
                            label: __('Select a field...', 'subtleforms'),
                            value: '',
                          },
                          ...fieldOptions,
                        ]}
                        onChange={(value) =>
                          handlePaymentSettingChange('amountField', value)
                        }
                        help={__(
                          'Field that contains the payment amount',
                          'subtleforms'
                        )}
                      />
                    )}

                    <div className='sf-info-box sf-info-box--yellow'>
                      <p className='sf-info-box__text'>
                        <strong>{__('Extension Point:', 'subtleforms')}</strong>{' '}
                        {__(
                          'Payment gateway settings will appear here when payment extensions are installed.',
                          'subtleforms'
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </PanelBody>
          )}

          {/* Checkout — WooCommerce or SubtleForms (2.1). */}
          {takesMoney && (
            <CheckoutPanel
              schema={schema}
              fields={pricedFields}
              onPayment={handleCheckoutChange}
              isReadOnly={isReadOnly}
            />
          )}

          {/* Integrations: email marketing, CRM and analytics per form (2.1). */}
          <IntegrationsPanel schema={schema} onChange={onChange} isReadOnly={isReadOnly} />

          <PanelBody
            title={__('Advanced', 'subtleforms')}
            initialOpen={false}>
            <RadioControl
              label={__('Builder canvas width', 'subtleforms')}
              selected={metadata.canvasWidth || 'standard'}
              options={[
                {
                  label: __('Narrow (640px)', 'subtleforms'),
                  value: 'narrow',
                },
                {
                  label: __('Standard (768px)', 'subtleforms'),
                  value: 'standard',
                },
                {
                  label: __('Wide (1024px)', 'subtleforms'),
                  value: 'wide',
                },
              ]}
              onChange={(value) => handleMetadataChange('canvasWidth', value)}
              help={__(
                'Editing width inside the builder only. The published form’s width is set under Preview.',
                'subtleforms'
              )}
            />
            <TextControl
              label={__('Internal identifier', 'subtleforms')}
              value={metadata.name || 'form_schema'}
              onChange={(value) => handleMetadataChange('name', value)}
              help={__(
                'Machine name used in exports and developer hooks. Most forms can leave this as it is.',
                'subtleforms'
              )}
            />
          </PanelBody>

        </Panel>
      </div>
    </div>
  );
}
