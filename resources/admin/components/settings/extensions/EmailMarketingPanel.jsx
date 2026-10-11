import { useState } from '@wordpress/element';
import { ToggleControl, TextControl, SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import FieldError from '../FieldError';
import ConnectionTest from './ConnectionTest';

export const EMAIL_PROVIDERS = [
  { label: 'Mailchimp', value: 'mailchimp' },
  { label: 'Brevo (Sendinblue)', value: 'brevo' },
  { label: 'Kit (ConvertKit)', value: 'convertkit' },
];

const KEY_HELP = {
  mailchimp: __('Mailchimp: Profile > Extras > API keys. The key ends with your data center, for example -us21.', 'subtleforms'),
  brevo: __('Brevo: SMTP & API > API keys. Use a v3 API key, not the SMTP password.', 'subtleforms'),
  convertkit: __('Kit: Settings > Developer > API keys. Use a v4 API key.', 'subtleforms'),
};

const LIST_LABEL = {
  mailchimp: __('Default audience', 'subtleforms'),
  brevo: __('Default list', 'subtleforms'),
  convertkit: __('Default Kit form', 'subtleforms'),
};

const LIST_HELP = {
  mailchimp: __('New subscribers join this audience unless a form picks another one.', 'subtleforms'),
  brevo: __('New contacts are added to this list unless a form picks another one.', 'subtleforms'),
  convertkit: __('Subscribers are added to this Kit form (optional). Leave empty to only create the subscriber.', 'subtleforms'),
};

/**
 * Email Marketing Extension Settings Panel
 */
export default function EmailMarketingPanel({ settings, updateSetting, fieldErrors = {} }) {
  const provider = settings.ext_email_marketing_provider || 'mailchimp';
  const [lists, setLists] = useState(null);

  const listValue = settings.ext_email_marketing_list_id || '';
  const listOptions = lists
    ? [
        { label: __('No default (choose per form)', 'subtleforms'), value: '' },
        ...lists.map((l) => ({
          label:
            l.count !== null && l.count !== undefined
              ? sprintf(
                  /* translators: 1: list name, 2: number of contacts */
                  __('%1$s (%2$s)', 'subtleforms'),
                  l.name,
                  Number(l.count).toLocaleString()
                )
              : l.name,
          value: String(l.id),
        })),
        // Keep a saved value visible even if it is no longer returned.
        ...(listValue && !lists.some((l) => String(l.id) === listValue)
          ? [
              {
                /* translators: %s: list ID */
                label: sprintf(__('%s (not found)', 'subtleforms'), listValue),
                value: listValue,
              },
            ]
          : []),
      ]
    : null;

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Email Marketing', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Add people who fill in your forms to Mailchimp, Brevo or Kit. Connect your account here, then switch it on for each form under Form settings > Integrations.',
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
            help={__('Turning this off pauses subscriptions on every form.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_email_marketing_enabled} />
        </div>

        {settings.ext_email_marketing_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('Provider', 'subtleforms')}
                value={provider}
                options={EMAIL_PROVIDERS}
                onChange={(v) => {
                  updateSetting('ext_email_marketing_provider', v);
                  updateSetting('ext_email_marketing_list_id', '');
                  setLists(null);
                }}
              />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('API key', 'subtleforms')}
                type='password'
                autoComplete='off'
                value={settings.ext_email_marketing_api_key || ''}
                onChange={(v) => {
                  updateSetting('ext_email_marketing_api_key', v);
                  setLists(null);
                }}
                help={KEY_HELP[provider]}
              />
              <FieldError errors={fieldErrors.ext_email_marketing_api_key} />
              <div style={{ marginTop: 12 }}>
                <ConnectionTest
                  path='/integrations/email-marketing/test'
                  label={__('Test connection and load lists', 'subtleforms')}
                  disabled={!settings.ext_email_marketing_api_key}
                  getBody={() => ({
                    provider,
                    api_key: settings.ext_email_marketing_api_key || '',
                  })}
                  onSuccess={(res) => setLists(Array.isArray(res.lists) ? res.lists : [])}
                />
              </div>
            </div>

            <div className='sf-settings-field'>
              {listOptions ? (
                <SelectControl
                  label={LIST_LABEL[provider]}
                  value={listValue}
                  options={listOptions}
                  onChange={(v) => updateSetting('ext_email_marketing_list_id', v)}
                  help={LIST_HELP[provider]}
                />
              ) : (
                <TextControl
                  label={LIST_LABEL[provider]}
                  value={listValue}
                  onChange={(v) => updateSetting('ext_email_marketing_list_id', v)}
                  help={`${LIST_HELP[provider]} ${__('Test the connection to pick from your lists.', 'subtleforms')}`}
                />
              )}
              <FieldError errors={fieldErrors.ext_email_marketing_list_id} />
            </div>

            {provider === 'mailchimp' && (
              <div className='sf-settings-field'>
                <ToggleControl
                  label={__('Double opt-in', 'subtleforms')}
                  checked={!!settings.ext_email_marketing_double_optin}
                  onChange={(v) => updateSetting('ext_email_marketing_double_optin', v)}
                  help={__(
                    'New subscribers are added as "pending" and Mailchimp emails them to confirm. Existing members keep their current status.',
                    'subtleforms'
                  )}
                />
                <FieldError errors={fieldErrors.ext_email_marketing_double_optin} />
              </div>
            )}

            <div className='sf-ext-panel__info'>
              <p className='sf-ext-panel__info-text'>
                {provider === 'mailchimp' &&
                  __(
                    'Each form maps its email, first name (FNAME), last name (LNAME) and any other merge tags, and can add tags. Someone who already unsubscribed is never subscribed again.',
                    'subtleforms'
                  )}
                {provider === 'brevo' &&
                  __(
                    'Each form maps its email, first name (FIRSTNAME), last name (LASTNAME) and any other contact attributes. Existing contacts are updated.',
                    'subtleforms'
                  )}
                {provider === 'convertkit' &&
                  __(
                    'Each form maps its email and first name, any custom fields that exist in Kit, and can apply tags that already exist in Kit.',
                    'subtleforms'
                  )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
