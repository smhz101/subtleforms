import { useState, useEffect } from '@wordpress/element';
import {
  SelectControl,
  TextControl,
  ToggleControl,
  Panel,
  PanelBody,
  PanelRow,
  RadioControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * FormSettings - Configure form-wide settings including payment options
 */
export default function FormSettings({ schema, onChange }) {
  const metadata = schema?.metadata || {};
  const formType = metadata.type || 'regular';
  const isPaymentForm = formType === 'payment';
  const isConversationalForm = formType === 'conversational';
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
    <div className='bg-gray-50 p-6 h-full overflow-y-auto subtleforms-form-settings'>
      <div className='mx-auto max-w-3xl'>
        <h2 className='mb-6 font-semibold text-gray-900 text-xl'>
          {__('Form Settings', 'subtleforms')}
        </h2>

        {/* General Settings */}
        <Panel>
          <PanelBody
            title={__('General Settings', 'subtleforms')}
            initialOpen={true}>
            <PanelRow>
              <TextControl
                label={__('Form Name', 'subtleforms')}
                value={metadata.name || 'form_schema'}
                onChange={(value) => handleMetadataChange('name', value)}
                help={__(
                  'Internal identifier for this form schema',
                  'subtleforms'
                )}
              />
            </PanelRow>
            <PanelRow>
              <TextControl
                label={__('Form Description', 'subtleforms')}
                value={metadata.description || ''}
                onChange={(value) => handleMetadataChange('description', value)}
                help={__(
                  'Optional description for documentation purposes',
                  'subtleforms'
                )}
              />
            </PanelRow>
          </PanelBody>
        </Panel>

        {/* Payment Settings - Show for payment forms and conversational forms */}
        {supportsPayment && (
          <Panel className='mt-4'>
            <PanelBody
              title={__('Payment Settings', 'subtleforms')}
              initialOpen={true}>
              <div className='space-y-4'>
                {isConversationalForm && (
                  <div className='bg-blue-50 p-4 border border-blue-200 rounded'>
                    <p className='text-blue-800 text-sm'>
                      <strong>{__('Conversational Payment:', 'subtleforms')}</strong>{' '}
                      {__(
                        'When enabled, users will answer questions, review their answers, and then complete payment before submission.',
                        'subtleforms'
                      )}
                    </p>
                  </div>
                )}

                {isPaymentForm && (
                  <div className='bg-blue-50 p-4 border border-blue-200 rounded'>
                    <p className='text-blue-800 text-sm'>
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

                    <div className='bg-yellow-50 mt-4 p-4 border border-yellow-200 rounded'>
                      <p className='text-yellow-800 text-sm'>
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
          </Panel>
        )}

        {/* Non-payment/non-conversational form message */}
        {!supportsPayment && (
          <Panel className='mt-4'>
            <PanelBody
              title={__('Payment Settings', 'subtleforms')}
              initialOpen={false}>
              <p className='text-gray-600 text-sm'>
                {__(
                  'Payment settings are available for "Payment" and "Conversational" form types. Create a payment or conversational form to enable payment collection.',
                  'subtleforms'
                )}
              </p>
            </PanelBody>
          </Panel>
        )}
      </div>
    </div>
  );
}
