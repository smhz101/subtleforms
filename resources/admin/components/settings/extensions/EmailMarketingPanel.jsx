import { ToggleControl, TextControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

/**
 * Email Marketing Extension Settings Panel
 */
export default function EmailMarketingPanel({ settings, updateSetting, fieldErrors = {} }) {
  const provider = settings.ext_email_marketing_provider || 'mailchimp';

  const PROVIDERS = [
    { label: 'Mailchimp', value: 'mailchimp' },
    { label: 'ConvertKit', value: 'convertkit' },
  ];

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Email Marketing', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Automatically subscribe form submitters to your Mailchimp list or ConvertKit sequence.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable Email Marketing', 'subtleforms')}
            checked={!!settings.ext_email_marketing_enabled}
            onChange={(v) => updateSetting('ext_email_marketing_enabled', v)}
            help={__('Subscribe submitters to your email marketing list.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_email_marketing_enabled} />
        </div>

        {settings.ext_email_marketing_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('Provider', 'subtleforms')}
                value={provider}
                options={PROVIDERS}
                onChange={(v) => updateSetting('ext_email_marketing_provider', v)}
              />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('API Key', 'subtleforms')}
                type='password'
                value={settings.ext_email_marketing_api_key || ''}
                onChange={(v) => updateSetting('ext_email_marketing_api_key', v)}
                help={
                  provider === 'mailchimp'
                    ? __('Your Mailchimp API key (ends with -usX).', 'subtleforms')
                    : __('Your ConvertKit API key.', 'subtleforms')
                }
              />
              <FieldError errors={fieldErrors.ext_email_marketing_api_key} />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={
                  provider === 'mailchimp'
                    ? __('Audience / List ID', 'subtleforms')
                    : __('Form ID', 'subtleforms')
                }
                value={settings.ext_email_marketing_list_id || ''}
                onChange={(v) => updateSetting('ext_email_marketing_list_id', v)}
                help={
                  provider === 'mailchimp'
                    ? __('The Mailchimp audience ID to subscribe to.', 'subtleforms')
                    : __('The ConvertKit form ID subscribers will be added to.', 'subtleforms')
                }
              />
              <FieldError errors={fieldErrors.ext_email_marketing_list_id} />
            </div>

            {provider === 'mailchimp' && (
              <div className='sf-settings-field'>
                <ToggleControl
                  label={__('Double Opt-in', 'subtleforms')}
                  checked={!!settings.ext_email_marketing_double_optin}
                  onChange={(v) => updateSetting('ext_email_marketing_double_optin', v)}
                  help={__(
                    'Send a confirmation email before adding to the list (recommended).',
                    'subtleforms'
                  )}
                />
                <FieldError errors={fieldErrors.ext_email_marketing_double_optin} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
